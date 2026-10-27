// ShareIntentRouter — routes a WARM inbound OS share (the app already
// running, on some other screen) to wherever it belongs.
//
// Live in-place navigation (useRouter().push(), gated on navigatorReady.js),
// for BOTH platforms. This went through many rounds of on-device-disproven
// fixes (readiness polling of every kind, InteractionManager, double-rAF,
// component tree position, dispatch method) chasing two DIFFERENT real bugs
// underneath --
//   1. A hard crash ("Attempted to navigate before mounting the Root Layout
//      component") from expo-router's assertIsReady(), fixed by
//      navigatorReady.js's ground-truth readiness check.
//   2. Even once that crash was gone: "The action 'PUSH' ... was not
//      handled by any navigator" -- a DIFFERENT failure where the navigator
//      IS ready, but resolves "share" against the wrong navigator context
//      when dispatched from a background effect this deep in the Tabs tree.
//      Expo Router's own error text for this says outright: "This is a
//      development-only warning and won't be shown in production" -- in a
//      real build this is a SILENT no-op, matching Josh's original report
//      ("either nothing happens or it crashes, mostly nothing"). STILL
//      UNRESOLVED -- this is where the investigation currently stands.
//
// TRIED AND REVERTED: forcing a full JS reload (DevSettings.reload()) on
// Android instead of navigating in place, so app/index.js's entry-screen
// <Redirect> would handle it fresh (that path has never hit either bug
// above). On-device this was WORSE, not better -- DevSettings.reload() only
// re-executes JS, it doesn't repeat Android's real onNewIntent/Activity
// lifecycle the way an actual relaunch does, and the fresh bundle hung on a
// white screen requiring a force-close (most likely expo-share-intent's
// native module not re-delivering correctly on a JS-only reload). A real
// version of this idea would need a genuine native relaunch, which needs
// expo-updates + Updates.reloadAsync() (not installed) -- a bigger,
// separate follow-up, not a same-night fix.
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
//   * Delivery waits for account hydration, so a share never lands on a
//     screen that bounces to /welcome.
//   * A persisted content key dedupes Android's recents-replay across cold
//     starts; it's cleared on a clean launch so re-sharing works later.

import { useEffect, useRef, useState } from "react";
import { AppState, InteractionManager, Platform, Text, View } from "react-native";
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
import { isNavigatorReady } from "../lib/navigatorReady.js";

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

      // ANDROID RELOAD STRATEGY -- TRIED AND REVERTED. DevSettings.reload()
      // only re-executes JS; it does NOT repeat Android's real
      // onNewIntent/Activity lifecycle the way an actual relaunch does.
      // Confirmed on-device: triggering it here produced a WORSE failure
      // than the live-navigation path below -- the fresh bundle's own log
      // went completely silent right after its entry.js bundle finished
      // (never even reached the AsyncStorage warning every other boot hits
      // within milliseconds), and the app hung on a white screen requiring
      // a force-close. Most likely cause: expo-share-intent's native module
      // doesn't re-deliver (or gets into a bad state) on a JS-only reload
      // the way it does on a genuine cold start. Making every warm share a
      // full native relaunch (not just a JS reload) might still work, but
      // that needs expo-updates + a real production reload path anyway, so
      // it's a bigger follow-up, not a same-night fix. Reverted to the
      // live-navigation path below for both platforms -- its known flaw
      // (the dev-only "not handled by any navigator" warning, silent no-op
      // in production) is strictly better than a hung white screen.

      // Readiness polling is back (see tryDispatch below), but reading a
      // DIFFERENT signal than the one that failed before: an earlier
      // attempt polled navigationRef.isReady() via a proxy (routeNames from
      // useRootNavigationState()) with a forced-fire fallback, and that
      // fallback was proven, on-device, to always be what actually fired --
      // not real readiness. This isn't needed for the "long-warm, fully
      // settled feed" case at all (that case was never the one crashing);
      // it's for the narrow window right after a cold/relaunch, where
      // app/index.js's own redirect to /feed and this component's mount can
      // both land inside the same initial boot cascade, before the root
      // navigator has genuinely finished its first onReady.
      deliveringRef.current = true;
      let ok = false;
      // d.router (useRouter() hook instance, captured fresh every render via
      // dataRef) -- NOT the bare `router` singleton import. See the
      // component-level comment on why: the singleton isn't tethered to
      // this component's actual place in the navigation tree.
      const pathnameBefore = dataRef.current?.pathname;
      // d.router.push() confirmed correctly UPDATES React Navigation's own
      // real state (onStateChange fires, usePathname() reports "/share"),
      // but the SCREEN never visually changes in some tests, and in others
      // it hard-crashes with "Attempted to navigate before mounting the Root
      // Layout component". CONFIRMED via a real onPress button (DBG button,
      // feed.js) calling this exact router.push(target) from this exact
      // component position: it works every time. So the route, the dispatch
      // method, and the component's tree position were never the problem.
      //
      // The actual mechanism (confirmed by reading expo-router's own
      // source): router.push()/replace() never dispatch synchronously --
      // they enqueue into an internal routingQueue, flushed by a SEPARATE,
      // decoupled effect (useImperativeApiEmitter, inside expo-router's own
      // ExpoRoot tree) on its own schedule. That flush is what calls
      // store.assertIsReady(), and throws if navigationRef.isReady() is
      // false at THAT moment -- which is why no try/catch here can ever
      // catch it, and why InteractionManager + double-requestAnimationFrame
      // (waiting for JS-interaction-idle / a fresh paint frame) didn't fix
      // it either: neither of those is the same signal as "has the
      // NavigationContainer completed its first onReady". navigatorReady.js
      // reads that exact boolean directly from expo-router's internal
      // store -- the literal thing assertIsReady() checks -- so gate on
      // that specifically, with a short bounded poll and NO forced-fire
      // fallback (the forced-fire fallback from an earlier attempt at this
      // was proven, via on-device testing, to always be the thing that
      // fired regardless of real safety -- that's the crash source this
      // replaces).
      // MAX_ATTEMPTS*100ms budget. Bumped from 20 (2s) -- on the one test run
      // so far, isNavigatorReady() never flipped true within 2s even though
      // the feed was fully rendered/interactive by the time the screenshot
      // was taken a moment later. That could mean either a genuinely slow
      // settle (this share arrived right as Android silently killed and
      // relaunched the backgrounded app, closer to a cold start than a warm
      // share) or a real disconnect between this check and the live
      // navigator -- routeNamesCount below (JSON-safe, unlike the previous
      // routeNames field which silently vanished from the debug overlay
      // whenever it was undefined, since JSON.stringify drops undefined
      // values) is there to tell the two apart on the next run.
      const MAX_ATTEMPTS = 80;
      const tryDispatch = (attemptsLeft) => {
        const ready = isNavigatorReady();
        const rn = dataRef.current?.routeNames;
        if (attemptsLeft === MAX_ATTEMPTS || attemptsLeft % 10 === 0) {
          console.log("[ShareIntentRouter] readiness check", { ready, attemptsLeft, routeNames: rn });
          setDebug((p) => ({ ...p, step: "polling", attemptsLeft, ready, routeNamesCount: Array.isArray(rn) ? rn.length : String(rn) }));
        }
        if (!ready) {
          if (attemptsLeft <= 0) {
            deliveringRef.current = false;
            setDebug((p) => ({ ...p, step: "gave-up-not-ready", routeNamesCount: Array.isArray(rn) ? rn.length : String(rn) }));
            return;
          }
          setTimeout(() => tryDispatch(attemptsLeft - 1), 100);
          return;
        }
        try { d.router.push(target); ok = true; } catch (e) { ok = false; setDebug((p) => ({ ...p, error: `push: ${e?.message}` })); }
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
      };
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tryDispatch(MAX_ATTEMPTS); // up to ~8s of polling, then give up silently
          });
        });
      });
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
