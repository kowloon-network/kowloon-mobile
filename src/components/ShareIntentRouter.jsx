// ShareIntentRouter — routes a WARM inbound OS share into the composer (the
// app already running, on some other screen).
//
// The COLD-START case (a share LAUNCHES the app) is deliberately NOT handled
// here anymore -- it's handled in app/index.js, the app's actual entry
// screen, using the exact same <Redirect> mechanism that file already uses
// for its normal /welcome-vs-/feed boot choice. That distinction exists
// because of a real, confirmed bug: on Android, a share arrives with
// hasShareIntent already true on the very first render, and navigating from
// THIS component (a global sibling of <Stack/>, not a routed screen itself)
// raced ahead of Expo Router's own navigator readiness -- confirmed on-device
// across five separate readiness-gating attempts (navReady, routeNames
// inclusion, navigationRef.isReady(), useSegments() resolving, and various
// combinations), each replaced in turn as on-device testing disproved it.
// expo-share-intent's own official Expo Router example handles this the same
// way we now do -- redirecting from inside the app's real entry screen,
// where a screen's own effect can only run once the Stack has already
// resolved and rendered it. shareTarget.js holds the shared shareKey/
// targetFor logic both paths use, so a given share payload resolves to the
// exact same target regardless of which path handles it.
//
// Uses expo-share-intent's CONTEXT (fed by <ShareIntentProvider> in the root
// layout). Safe in Expo Go — the native module is optional there, so
// hasShareIntent simply stays false.
//
//   URL   -> /share?url=...   (chooser: Link post or bookmark — issue #82)
//   text  -> Note, editor seeded with the text
//   files -> Media, added as attachments
//
// Reliability (a share is delivery-once, never dropped, never replayed):
//   * Navigates via useRouter()'s returned instance, NOT the bare `router`
//     singleton import -- confirmed live that BOTH .replace() and
//     .navigate() failed identically ("not handled by any navigator") from
//     the singleton, even from a fully healthy, fully-rendered warm screen,
//     ruling out timing, readiness, and parent-bubbling theories alike (a
//     direct URL load of the same route resolved it fine, via Expo Router's
//     separate linking/initial-state mechanism -- proving the ROUTE itself
//     was never the problem). app/index.js's <Redirect> -- which has always
//     worked -- uses useRouter() internally too (confirmed by reading its
//     source); the singleton dispatches against a global nav ref that isn't
//     tethered to any specific screen's actual place in the tree the way a
//     hook resolved through this component's own render is.
//   * No readiness polling -- confirmed on-device that navigationRef.
//     isReady() can stay false indefinitely even from an obviously healthy,
//     fully-rendered screen, so it was never a usable gate regardless.
//   * Delivery waits for account hydration, so a share never lands on a
//     screen that bounces to /welcome.
//   * A persisted content key dedupes Android's recents-replay across cold
//     starts; it's cleared on a clean launch so re-sharing works later.

import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useSelector } from "react-redux";

import {
  getLastConsumedShare,
  setLastConsumedShare,
  clearLastConsumedShare,
} from "../lib/shareDedupe.js";
import { shareKey, targetFor } from "../lib/shareTarget.js";
import { selectAccountsStatus } from "../state/accountsSlice.js";

// TEMP DEBUG — remove once the Android "share does nothing" bug is
// root-caused. handleShare's outer catch deliberately swallows every error
// ("never let a share crash the app") which means a real thrown error would
// look EXACTLY like "nothing happens" with zero visibility into why. This
// surfaces what's actually happening on-screen instead of guessing blind.
export function ShareIntentRouter() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const accountsStatus = useSelector(selectAccountsStatus);
  const hydrated = accountsStatus === "ready" || accountsStatus === "error";
  const [debug, setDebug] = useState(null);
  // TEMP DIAGNOSTIC ONLY -- not a gate, just logged alongside the failure so
  // we can see the actual routeNames Expo Router is working with at the
  // exact moment "not handled by any navigator" fires.
  const navState = useRootNavigationState();
  // useRouter() (a HOOK, resolved via this component's own position in the
  // React tree) instead of the bare `router` singleton import. This is
  // almost certainly the real fix: app/index.js's <Redirect> -- which has
  // worked reliably this whole time -- uses useRouter() internally too
  // (confirmed by reading its source). The bare singleton dispatches
  // against a global nav ref that isn't tethered to any specific screen's
  // place in the tree; neither .replace() nor .navigate() ever finding
  // "share" from THIS component, while a direct URL load resolves it fine
  // (Expo Router's separate linking/initial-state mechanism, not runtime
  // dispatch), is consistent with the singleton not correctly reaching the
  // real nested Stack at all -- not a timing or bubbling issue.
  const router = useRouter();
  // TEMP DIAGNOSTIC -- the actual current path, re-read a moment after
  // calling navigate() to confirm definitively whether it changed at all,
  // rather than inferring success/failure from the absence of an error.
  const pathname = usePathname();

  // Latest values behind a ref so the (stable) AppState listener never sees
  // stale data and doesn't need to re-subscribe.
  const dataRef = useRef(null);
  dataRef.current = { hasShareIntent, shareIntent, resetShareIntent, hydrated, routeNames: navState?.routeNames, router, pathname };

  const lastConsumedRef = useRef(null); // persisted key of the last delivered share
  const deliveringRef = useRef(false); // a navigate is scheduled/in-flight
  const clearTimerRef = useRef(null); // pending clean-launch marker clear

  const handleShare = useRef(null);
  handleShare.current = () => {
    try {
      const d = dataRef.current || {};
      setDebug({
        step: "entry",
        hasShareIntent: d.hasShareIntent,
        shareIntentSummary: d.shareIntent
          ? {
              webUrl: d.shareIntent.webUrl,
              text: typeof d.shareIntent.text === "string" ? d.shareIntent.text.slice(0, 40) : d.shareIntent.text,
              filesCount: Array.isArray(d.shareIntent.files) ? d.shareIntent.files.length : null,
              mimeType: d.shareIntent.meta?.mimeType,
            }
          : null,
        hydrated: d.hydrated,
      });

      // Clean launch (no share present): after a short settle delay, clear the
      // dedupe marker so re-sharing the same URL later works. The delay guards
      // against the brief no-share window on a cold-start share; if a share
      // arrives we cancel the clear below.
      if (!d.hasShareIntent || !d.shareIntent) {
        if (!clearTimerRef.current) {
          clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = null;
            if (dataRef.current && !dataRef.current.hasShareIntent) {
              lastConsumedRef.current = null;
              clearLastConsumedShare();
            }
          }, 1200);
        }
        return;
      }
      // A share is present — cancel any pending clean-launch clear.
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      let key = "";
      try { key = shareKey(d.shareIntent); } catch (e) { setDebug((p) => ({ ...p, error: `shareKey: ${e?.message}` })); key = ""; }
      if (!key) {
        setDebug((p) => ({ ...p, step: "no-key", note: "shareKey() returned empty — shareIntent shape not matched" }));
        try { d.resetShareIntent?.(); } catch {} return;
      }

      // Replay of an already-delivered share (Android recents re-fires the
      // launch intent). Drop it.
      if (key === lastConsumedRef.current) {
        setDebug((p) => ({ ...p, step: "dropped-replay", key }));
        try { d.resetShareIntent?.(); } catch {}
        return;
      }

      // Wait for accounts to finish hydrating so we never route into a screen
      // that bounces to /welcome. The effect re-runs when hydration completes.
      if (!d.hydrated) { setDebug((p) => ({ ...p, step: "waiting-hydration" })); return; }

      // One delivery scheduled/in-flight at a time.
      if (deliveringRef.current) { setDebug((p) => ({ ...p, step: "already-delivering" })); return; }

      let target = null;
      try { target = targetFor(d.shareIntent); } catch (e) { setDebug((p) => ({ ...p, error: `targetFor: ${e?.message}` })); target = null; }
      if (!target) {
        setDebug((p) => ({ ...p, step: "no-target", note: "targetFor() returned null" }));
        try { d.resetShareIntent?.(); } catch {} return;
      }

      // Plain console.log (not just setDebug) -- shows up directly in the
      // Metro terminal, so this can be checked without relaying a
      // screenshot each time.
      console.log("[ShareIntentRouter] navigating", { target, routeNames: dataRef.current?.routeNames });
      setDebug((p) => ({ ...p, step: "navigating", target, routeNames: dataRef.current?.routeNames }));

      // No readiness polling anymore -- confirmed on-device that
      // navigationRef.isReady() can stay false indefinitely even from an
      // obviously healthy, fully-rendered screen, so it was never a usable
      // gate here (previously: 30 attempts, ~3s, isReady never true, on a
      // warm share fired from an already-fully-loaded feed). It's also not
      // NEEDED here anymore: cold start is handled entirely by
      // app/index.js now, so by definition this component only ever fires
      // for a share arriving while the app is ALREADY fully mounted and
      // running -- there's nothing left to wait for.
      deliveringRef.current = true;
      let ok = false;
      // d.router (useRouter() hook instance, captured fresh every render via
      // dataRef) -- NOT the bare `router` singleton import. See the
      // component-level comment on why: the singleton isn't tethered to
      // this component's actual place in the navigation tree.
      const pathnameBefore = dataRef.current?.pathname;
      try { d.router.navigate(target); ok = true; } catch (e) { ok = false; setDebug((p) => ({ ...p, error: `navigate: ${e?.message}` })); }
      if (ok) {
        setDebug((p) => ({ ...p, step: "delivered" }));
        lastConsumedRef.current = key;
        setLastConsumedShare(key);
        try { d.resetShareIntent?.(); } catch {}
      }
      deliveringRef.current = false;
      // Re-check the actual path shortly after -- did it change at all?
      setTimeout(() => {
        const pathnameAfter = dataRef.current?.pathname;
        console.log("[ShareIntentRouter] path check", { pathnameBefore, pathnameAfter, changed: pathnameBefore !== pathnameAfter });
        setDebug((p) => ({ ...p, pathnameBefore, pathnameAfter }));
      }, 500);
    } catch (e) {
      // never let a share crash the app -- but DO surface what happened.
      setDebug({ step: "outer-catch", error: e?.message || String(e) });
    }
  };

  // Load the persisted replay marker — NON-blocking (a share never waits on it).
  // Don't clobber a marker a delivery may have already set while we were loading.
  useEffect(() => {
    let cancelled = false;
    getLastConsumedShare().then((k) => {
      if (!cancelled && lastConsumedRef.current == null) lastConsumedRef.current = k;
    });
    return () => { cancelled = true; };
  }, []);

  // Fires whenever the share context changes (warm share) or accounts finish
  // hydrating.
  useEffect(() => {
    handleShare.current?.();
  }, [hasShareIntent, shareIntent, hydrated]);

  // Belt-and-suspenders: some devices deliver a warm share as the app returns
  // to the foreground without the context effect re-firing.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") handleShare.current?.();
    });
    return () => sub.remove();
  }, []);

  // TEMP DEBUG overlay — Android only (Josh confirmed iOS sharing works).
  // Floats at the top of whatever screen is showing so it survives
  // navigation into the composer. Remove alongside the setDebug calls above
  // once this is root-caused.
  if (Platform.OS !== "android" || !debug) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 40, left: 8, right: 8, zIndex: 9999 }}
    >
      <Text style={{ fontSize: 9, color: "red", backgroundColor: "rgba(255,255,255,0.9)" }}>
        SHARE DEBUG: {JSON.stringify(debug)}
      </Text>
    </View>
  );
}
