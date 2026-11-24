// The latest thing shared INTO Kowloon, held at module level -- once per JS
// runtime, not once per React root.
//
// Why (closed-app share, seen live over adb 2026-11-24): a share into a
// closed app starts Kowloon inside Feedly's task. That first React root owns
// the app (src/lib/singleRoot.js) while expo-share-intent restarts the share
// in Kowloon's own task, which starts a second root that waits. The native
// share event can fire while the FIRST root is still the owner, so the
// per-root useShareIntent() state inside it catches the share -- and then
// that root is torn down and the new owner starts with empty state. No sheet.
// A listener registered once, here, outside React, catches the event no
// matter which root is alive, and whichever root shows the sheet reads it.
//
// ShareIntentProvider (app/_layout.js) is still mounted: it is what ASKS the
// native module for pending shares (on mount, on app-active, and on iOS on
// the share extension's kowloon://dataUrl= link). This file only listens.

import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { ShareIntentModule, getShareExtensionKey, parseShareIntent } from "expo-share-intent";

let current = null;
const subscribers = new Set();

function set(next) {
  current = next;
  subscribers.forEach((fn) => fn());
}

function hasValue(si) {
  return !!(si && (si.text || si.webUrl || (Array.isArray(si.files) && si.files.length)));
}

if (Platform.OS !== "web" && ShareIntentModule) {
  ShareIntentModule.addListener("onChange", (event) => {
    try {
      const si = parseShareIntent(event?.value, {});
      if (hasValue(si)) set(si);
    } catch {
      // unparseable share -- ignore it rather than show a broken sheet
    }
  });
}

export function clearShare() {
  try {
    ShareIntentModule?.clearShareIntent(getShareExtensionKey({}));
  } catch {}
  set(null);
}

function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function useShare() {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
