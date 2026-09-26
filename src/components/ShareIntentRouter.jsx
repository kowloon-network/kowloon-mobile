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
//   * We only consume/reset a share AFTER a confirmed-successful navigate --
//     gated on navigationRef.isReady(), polling with a bounded retry. If it
//     never becomes ready within that bound, we give up SILENTLY (no forced
//     navigate) rather than fire a call we can't confirm is safe -- a share
//     that doesn't deliver instantly is far better than one that crashes
//     the app. Confirmed on-device: a bounded "fire anyway" fallback here
//     used to crash even from an obviously healthy, fully-rendered screen,
//     because the OTHER signal it was ANDed with (useSegments() resolving)
//     turned out to never reliably become true at all in this app -- not
//     "eventually", genuinely never, so the fallback always ended up being
//     the thing that fired, and it wasn't actually safe.
//   * Delivery waits for account hydration, so a share never lands on a
//     screen that bounces to /welcome.
//   * A persisted content key dedupes Android's recents-replay across cold
//     starts; it's cleared on a clean launch so re-sharing works later.

import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { router, useRootNavigation } from "expo-router";
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
  // navigationRef.isReady() -- the live check Expo Router's own internal
  // assertion uses. Not a perfect guarantee (isReady() true doesn't always
  // mean a specific route name is dispatchable), but it's the best signal
  // available from outside the screen tree, and -- critically -- NEVER
  // forced past when it's false (see tryNavigate below for why).
  const rootNavigation = useRootNavigation();

  // Latest values behind a ref so the (stable) AppState listener never sees
  // stale data and doesn't need to re-subscribe.
  const dataRef = useRef(null);
  dataRef.current = { hasShareIntent, shareIntent, resetShareIntent, hydrated, rootNavigation };

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

      setDebug((p) => ({ ...p, step: "navigating", target }));

      // Poll navigationRef.isReady(). Deliberately NO forced-fire fallback
      // anymore -- confirmed on-device (screenshots showing a fully
      // rendered, working feed) that useSegments() can stay empty forever
      // even from an obviously healthy, fully-functional screen, meaning a
      // bounded "give up and fire anyway" fallback would ALWAYS eventually
      // fire regardless of real readiness, and this exact call is the one
      // that crashes when it isn't genuinely ready. A share that can't be
      // delivered promptly is far better than a crash: give up silently
      // (leave hasShareIntent/shareIntent untouched) and let the next
      // trigger -- another context change, or the AppState "active"
      // listener below -- retry from scratch.
      deliveringRef.current = true;
      let attempts = 0;
      const MAX_ATTEMPTS = 30; // ~3s at 100ms apiece
      const tryNavigate = () => {
        const isReady = dataRef.current?.rootNavigation?.isReady?.() === true;
        if (!isReady) {
          attempts += 1;
          if (attempts > MAX_ATTEMPTS) {
            setDebug((p) => ({ ...p, step: "gave-up", attempts }));
            deliveringRef.current = false;
            return;
          }
          setDebug((p) => ({ ...p, step: "waiting-isReady", attempts, isReady }));
          setTimeout(tryNavigate, 100);
          return;
        }
        let ok = false;
        // .replace(), not .navigate() -- matches Expo Router's own Redirect
        // component's choice; a share landing the user on the chooser/
        // composer shouldn't leave the pre-share screen behind in history.
        try { router.replace(target); ok = true; } catch (e) { ok = false; setDebug((p) => ({ ...p, error: `replace: ${e?.message}` })); }
        if (ok) {
          setDebug((p) => ({ ...p, step: "delivered", attempts }));
          lastConsumedRef.current = key;
          setLastConsumedShare(key);
          try { d.resetShareIntent?.(); } catch {}
        }
        deliveringRef.current = false;
      };
      setTimeout(tryNavigate, 0);
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
