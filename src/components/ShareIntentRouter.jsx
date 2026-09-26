// ShareIntentRouter — routes an inbound OS share into the composer.
//
// Uses expo-share-intent's CONTEXT (fed by <ShareIntentProvider> in the root
// layout), which is the supported way to receive the share on cold start via
// the deeplink. Mounted globally inside the provider + navigation + Redux
// context, so it catches cold launches (share opens the app) and warm shares
// (app already running). Safe in Expo Go — the native module is optional there,
// so hasShareIntent simply stays false.
//
//   URL   -> /share?url=...   (chooser: Link post or bookmark — issue #82)
//   text  -> Note, editor seeded with the text
//   files -> Media, added as attachments
//
// Reliability (a share is delivery-once, never dropped, never replayed):
//   * We only consume/reset a share AFTER a confirmed-successful navigate — a
//     failed nav is retried, not silently thrown away (the old code reset even
//     when navigate threw, dropping the share).
//   * Delivery waits for BOTH the navigator (root nav key) AND account
//     hydration, so a share never lands on a screen that bounces to /welcome.
//   * A persisted content key dedupes Android's recents-replay across cold
//     starts; it's cleared on a clean launch so re-sharing works later.

import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { router, useRootNavigationState } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useSelector } from "react-redux";

import { setPendingShare } from "../lib/pendingShare.js";
import {
  getLastConsumedShare,
  setLastConsumedShare,
  clearLastConsumedShare,
} from "../lib/shareDedupe.js";
import { selectAccountsStatus } from "../state/accountsSlice.js";

const URL_RE = /https?:\/\/\S+/i;

// A stable content key so a NEW share is always handled but the SAME one isn't
// re-handled.
function shareKey(si) {
  if (!si) return "";
  if (si.webUrl) return `url:${si.webUrl}`;
  if (typeof si.text === "string" && si.text) return `text:${si.text}`;
  if (Array.isArray(si.files) && si.files.length)
    return `files:${si.files.map((f) => f.path).join("|")}`;
  return "";
}

// Build the navigation target from a share payload; stashes text/files for the
// composer to consume, returns the route to navigate to (or null).
function targetFor(shareIntent) {
  const textMatch =
    typeof shareIntent.text === "string" ? shareIntent.text.match(URL_RE) : null;
  const url = shareIntent.webUrl || (textMatch ? textMatch[0] : null);
  // A shared URL goes to the chooser (Link post vs. bookmark).
  if (url) return `/share?url=${encodeURIComponent(url)}`;
  if (Array.isArray(shareIntent.files) && shareIntent.files.length) {
    setPendingShare({
      kind: "files",
      files: shareIntent.files.map((f) => ({
        uri: f.path,
        name: f.fileName,
        mimeType: f.mimeType,
      })),
    });
    return "/compose?fromShare=1";
  }
  if (shareIntent.text) {
    setPendingShare({ kind: "text", text: shareIntent.text });
    return "/compose?fromShare=1";
  }
  return null;
}

// TEMP DEBUG — remove once the Android "share does nothing" bug is
// root-caused. handleShare's outer catch deliberately swallows every error
// ("never let a share crash the app") which means a real thrown error would
// look EXACTLY like "nothing happens" with zero visibility into why. This
// surfaces what's actually happening on-screen instead of guessing blind.
export function ShareIntentRouter() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  // Root nav state existing (navReady) only means SOME navigator mounted --
  // not that the SPECIFIC route we're about to navigate to is registered in
  // its route table yet. Confirmed live: navReady was true, router.navigate()
  // ran with no throw, and Expo Router still logged "action NAVIGATE... was
  // not handled by any navigator -- do you have a route named 'share'?" (a
  // dev-only warning, but the navigate silently no-ops in production too --
  // this is likely the real cause of "nothing happens" on a cold-start
  // share). routeNames is what we actually need to gate on.
  const routeNames = navState?.routeNames || [];
  const accountsStatus = useSelector(selectAccountsStatus);
  const hydrated = accountsStatus === "ready" || accountsStatus === "error";
  const [debug, setDebug] = useState(null);

  // Latest values behind a ref so the (stable) AppState listener never sees
  // stale data and doesn't need to re-subscribe.
  const dataRef = useRef(null);
  dataRef.current = { hasShareIntent, shareIntent, resetShareIntent, navReady, hydrated, routeNames };

  const lastConsumedRef = useRef(null); // persisted key of the last delivered share
  const deliveringRef = useRef(false); // a navigate is scheduled/in-flight
  const clearTimerRef = useRef(null); // pending clean-launch marker clear

  const handleShare = useRef(null);
  handleShare.current = () => {
    try {
      const d = dataRef.current || {};
      setDebug({
        step: "entry",
        navReady: d.navReady,
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
      if (!d.navReady) return;

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

      // The route name Expo Router expects in routeNames -- "/share?url=..."
      // -> "share", "/compose?fromShare=1" -> "compose".
      const targetRouteName = target.split("?")[0].replace(/^\//, "");
      setDebug((p) => ({ ...p, step: "navigating", target, targetRouteName }));

      // DEFER the navigate, and don't fire until the target route actually
      // shows up in the root navigator's own route table -- navReady alone
      // (some navigator exists) isn't enough; confirmed live that Expo
      // Router can report ready and still not have "share"/"compose"
      // registered yet a tick later, silently dropping the navigate (a
      // dev-only warning, but the same silent no-op happens in production).
      // Bounded poll, not indefinite -- if the route genuinely never shows up
      // (unexpected route naming, etc.) we still attempt once at the end
      // rather than hang forever on a share we already committed to.
      deliveringRef.current = true;
      let attempts = 0;
      const MAX_ATTEMPTS = 20; // ~2s at 100ms apiece
      const tryNavigate = () => {
        const routeReady =
          dataRef.current?.routeNames?.includes(targetRouteName) || attempts >= MAX_ATTEMPTS;
        if (!routeReady) {
          attempts += 1;
          setDebug((p) => ({ ...p, step: "waiting-for-route", attempts, routeNames: dataRef.current?.routeNames }));
          setTimeout(tryNavigate, 100);
          return;
        }
        let ok = false;
        try { router.navigate(target); ok = true; } catch (e) { ok = false; setDebug((p) => ({ ...p, error: `navigate: ${e?.message}` })); }
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

  // Fires whenever the share context changes (warm share), the navigator becomes
  // ready (cold start), or accounts finish hydrating.
  useEffect(() => {
    handleShare.current?.();
  }, [navReady, hasShareIntent, shareIntent, hydrated]);

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
