// Durable dedupe for inbound OS shares.
//
// Android replays the launch intent when the app is reopened from RECENTS, so a
// purely in-memory "handled" flag (which resets on every cold start) lets the
// same share re-fire on the next few opens — the "it keeps popping up" bug.
// Persist the content key of the last successfully-delivered share; a matching
// inbound share is a replay and gets dropped. The marker is cleared on a clean
// launch (app opened with no share), so re-sharing the same URL later still
// works — and a clean launch also means Android has replaced the task's share
// intent with the launcher intent, so it won't replay after that anyway.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "kowloon:shareLastConsumed";

export async function getLastConsumedShare() {
  try {
    return (await AsyncStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export async function setLastConsumedShare(key) {
  try {
    await AsyncStorage.setItem(KEY, key);
  } catch {
    // non-fatal — worst case a replay slips through
  }
}

export async function clearLastConsumedShare() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // non-fatal
  }
}
