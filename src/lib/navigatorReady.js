// Ground-truth "is it safe to call router.push()/replace()?" check.
//
// router.push()/replace() never dispatch synchronously -- they enqueue into
// Expo Router's internal routingQueue, which a SEPARATE, decoupled effect
// (useImperativeApiEmitter, deep in expo-router's own ExpoRoot tree) flushes
// later, on its own schedule. That flush calls store.assertIsReady(), which
// throws "Attempted to navigate before mounting the Root Layout component"
// if navigationRef.isReady() is false at that moment -- a hard, uncaught
// crash, since the throw happens inside expo-router's own internals, not
// inside whatever code originally called .push()/.replace(). No try/catch
// at any of our call sites can ever catch it (confirmed: wrapping the call
// in try/catch, InteractionManager, and double-requestAnimationFrame all
// failed to prevent it, because none of them check the ACTUAL boolean the
// crash depends on -- they only wait for JS-interaction-idle or a fresh
// paint frame, neither of which is the same thing as "the NavigationContainer
// has completed its first onReady").
//
// This imports expo-router's internal store module directly (not its public
// API) to read navigationRef.isReady() -- the exact same boolean
// store.assertIsReady() checks -- rather than a proxy signal like
// usePathname() or useRootNavigationState()'s routeNames, both tried before
// and proven unreliable as readiness indicators. Once true, this is
// monotonic for the life of the app (the root container never becomes
// "unready" again), so checking it once, synchronously, right before
// calling push()/replace() is a valid gate even though the actual dispatch
// happens on a later tick.
//
// Deep-importing expo-router internals is inherently fragile across
// expo-router upgrades (this exact path could move/rename); if this stops
// resolving after a future upgrade, isNavigatorReady() below fails open
// (returns true) rather than breaking navigation entirely -- re-verify
// against expo-router's build/global-state/store.js after any upgrade.
import { useEffect, useState } from "react";

let storeModule;
try {
  // eslint-disable-next-line import/no-unresolved
  storeModule = require("expo-router/build/global-state/store");
} catch {
  storeModule = null;
}

export function isNavigatorReady() {
  try {
    return storeModule?.store?.navigationRef?.isReady?.() ?? true;
  } catch {
    return true;
  }
}

// Polls (via requestAnimationFrame, not a fixed timer) until isNavigatorReady()
// is true. NEVER force-fires -- if it never becomes true, this just never
// flips (the earlier bug in this investigation was a polling loop with a
// forced-fire fallback after N attempts, which on-device turned out to
// ALWAYS be the thing that fired, regardless of real readiness).
export function useNavigatorReady() {
  const [ready, setReady] = useState(isNavigatorReady);
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    let frame;
    const check = () => {
      if (cancelled) return;
      if (isNavigatorReady()) {
        setReady(true);
        return;
      }
      frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ready]);
  return ready;
}
