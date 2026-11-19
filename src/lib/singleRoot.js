// Only ONE copy of the app's UI may run at a time.
//
// Why (issue #86, found live over adb 2026-11-19): when you share into
// Kowloon from another Android app, the share sheet launches Kowloon's
// MainActivity with FLAG_ACTIVITY_NEW_DOCUMENT | MULTIPLE_TASK, inside the
// SENDING app's task. Android creates a second MainActivity even though one
// is already running, and React Native starts a second React root ("Running
// main ... rootTag 11") in the same JS runtime. Expo Router keeps its
// navigator in a global store, so the second root's ExpoRoot takes it over;
// expo-share-intent then finishes that extra activity (and re-delivers the
// share to the real one), the second root unmounts, and the global store is
// left pointing at a navigator that no longer exists. Every navigation after
// that throws "Attempted to navigate before mounting the Root Layout
// component" -- the crash and the white screen.
//
// The fix: the first root to mount owns the app. Any other root renders
// nothing (it is a throwaway activity that closes within a moment). When the
// owner goes away -- e.g. Android recreated the activity, or a cold-start
// share hands over to the real task -- the next waiting root takes over.

import { createElement, useContext, useEffect, useReducer } from "react";
import { RootTagContext } from "react-native";

let owner = null;
const waiting = new Set();

export function withSingleRoot(App) {
  function SingleRootApp(props) {
    const tag = useContext(RootTagContext);
    const [, rerender] = useReducer((n) => n + 1, 0);

    if (owner === null) owner = tag;

    useEffect(() => {
      waiting.add(rerender);
      return () => {
        waiting.delete(rerender);
        if (owner === tag) {
          owner = null;
          waiting.forEach((wake) => wake());
        }
      };
    }, [tag]);

    if (owner !== tag) return null;
    return createElement(App, props);
  }
  return SingleRootApp;
}
