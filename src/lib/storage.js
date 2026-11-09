// Account-namespaced AsyncStorage adapter for @kowloon/client.
//
// The client library hardcodes its storage key ("kowloon_token"). To run
// multiple accounts side by side, each KowloonClient gets a storage adapter
// that transparently prefixes every key with `kowloon:<accountId>:`.
//
// Account-list state (which accounts exist, which one is active) lives in
// Redux + a separate AsyncStorage key — see ../state/accountsSlice.js.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PREFIX = "kowloon";

function namespaceKey(accountId, key) {
  return `${PREFIX}:${accountId}:${key}`;
}

// The session token is the one secret here, so it lives in the OS keychain /
// keystore (expo-secure-store) instead of plain AsyncStorage. Everything else
// stays in AsyncStorage. react-native-web has no SecureStore, so web falls back.
const TOKEN_KEY = "kowloon_token";
const USE_SECURE_STORE = Platform.OS !== "web";

// SecureStore keys may only contain [A-Za-z0-9._-]. Escape every other char
// (and "_" itself, so the mapping stays collision-free) as _<hex>_.
function secureKey(accountId) {
  const safe = String(accountId).replace(
    /[^A-Za-z0-9.-]/g,
    (c) => `_${c.charCodeAt(0).toString(16)}_`
  );
  return `${PREFIX}.${safe}.${TOKEN_KEY}`;
}

async function getToken(accountId) {
  const legacyKey = namespaceKey(accountId, TOKEN_KEY);
  if (!USE_SECURE_STORE) return AsyncStorage.getItem(legacyKey);
  const sKey = secureKey(accountId);
  let secure = null;
  try {
    secure = await SecureStore.getItemAsync(sKey);
  } catch {
    // Keychain unreadable (e.g. device locked) -- fall through to the legacy
    // copy rather than logging the user out.
  }
  if (secure != null) return secure;
  // One-time migration: tokens saved by older builds sit in AsyncStorage.
  // Move them into SecureStore and drop the plaintext copy, so updating the
  // app doesn't sign anyone out.
  const legacy = await AsyncStorage.getItem(legacyKey);
  if (legacy != null) {
    try {
      await SecureStore.setItemAsync(sKey, legacy);
      await AsyncStorage.removeItem(legacyKey);
    } catch {
      // Couldn't write the keychain -- keep the legacy copy, retry next read.
    }
  }
  return legacy;
}

async function setToken(accountId, value) {
  const legacyKey = namespaceKey(accountId, TOKEN_KEY);
  if (!USE_SECURE_STORE) return AsyncStorage.setItem(legacyKey, value);
  try {
    await SecureStore.setItemAsync(secureKey(accountId), value);
  } catch {
    // Never let a keychain failure (e.g. an oversized value -- the JWT embeds
    // profile + block/mute lists) break sign-in: fall back to the old store.
    // Drop any older keychain copy, or getToken() would keep returning it.
    await SecureStore.deleteItemAsync(secureKey(accountId)).catch(() => {});
    await AsyncStorage.setItem(legacyKey, value);
    return;
  }
  await AsyncStorage.removeItem(legacyKey).catch(() => {});
}

async function removeToken(accountId) {
  await AsyncStorage.removeItem(namespaceKey(accountId, TOKEN_KEY));
  if (USE_SECURE_STORE) {
    await SecureStore.deleteItemAsync(secureKey(accountId)).catch(() => {});
  }
}

// Per-account key holding the Expo push token registered with that account's
// server, so sign-out can POST /push/unregister with it.
export const PUSH_TOKEN_KEY = "push_token";

export function makeAccountStorage(accountId) {
  if (!accountId) {
    throw new Error("makeAccountStorage requires an accountId");
  }
  return {
    async getItem(key) {
      if (key === TOKEN_KEY) return getToken(accountId);
      return AsyncStorage.getItem(namespaceKey(accountId, key));
    },
    async setItem(key, value) {
      if (key === TOKEN_KEY) return setToken(accountId, value);
      await AsyncStorage.setItem(namespaceKey(accountId, key), value);
    },
    async removeItem(key) {
      if (key === TOKEN_KEY) return removeToken(accountId);
      await AsyncStorage.removeItem(namespaceKey(accountId, key));
    },
    async clear() {
      const allKeys = await AsyncStorage.getAllKeys();
      const ours = allKeys.filter((k) => k.startsWith(`${PREFIX}:${accountId}:`));
      if (ours.length) await AsyncStorage.multiRemove(ours);
      await removeToken(accountId); // also wipes the SecureStore copy
    },
  };
}

// Drop everything we know about an account: token, any client-cached values,
// and (caller's responsibility) the entry in the accounts slice.
export async function purgeAccountStorage(accountId) {
  const adapter = makeAccountStorage(accountId);
  await adapter.clear();
}

// Top-level (non-per-account) keys. We use this for the accounts-list state
// itself so it survives across account switches.
export const ROOT_KEYS = {
  accounts: `${PREFIX}:accounts`,
};

export const rootStorage = {
  async getItem(key) {
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
  },
};
