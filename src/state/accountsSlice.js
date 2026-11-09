// Accounts state — one entry per logged-in Kowloon account.
//
// Tokens are NOT stored here. They live in the namespaced AsyncStorage that
// each KowloonClient owns (see ../lib/storage.js). This slice tracks only the
// metadata the app needs to render account pickers, decide the initial route,
// and instantiate the right client.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  rootStorage,
  ROOT_KEYS,
  purgeAccountStorage,
  makeAccountStorage,
  PUSH_TOKEN_KEY,
} from "../lib/storage.js";
import { forgetClient, getCachedClient, ensureClient } from "../lib/client.js";
import { Image } from "expo-image";
import { stopGlobalAudio } from "../lib/AudioPlayerProvider.jsx";

const initialState = {
  // Loaded from AsyncStorage on app boot.
  list: [],
  activeId: null,
  // Hydration lifecycle for the splash gate.
  status: "idle", // idle | loading | ready | error
  error: null,
};

export const hydrateAccounts = createAsyncThunk(
  "accounts/hydrate",
  async () => {
    const raw = await rootStorage.getItem(ROOT_KEYS.accounts);
    if (!raw) return { list: [], activeId: null };
    try {
      const parsed = JSON.parse(raw);
      return {
        list: Array.isArray(parsed?.list) ? parsed.list : [],
        activeId: parsed?.activeId || null,
      };
    } catch {
      return { list: [], activeId: null };
    }
  }
);

async function persist(state) {
  await rootStorage.setItem(
    ROOT_KEYS.accounts,
    JSON.stringify({ list: state.list, activeId: state.activeId })
  );
}

const slice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    addAccount(state, action) {
      const account = action.payload;
      if (!account?.id) return;
      const existing = state.list.findIndex((a) => a.id === account.id);
      if (existing >= 0) {
        state.list[existing] = { ...state.list[existing], ...account };
      } else {
        state.list.push(account);
      }
      state.activeId = account.id;
    },
    setActive(state, action) {
      const id = action.payload;
      if (state.list.some((a) => a.id === id)) {
        state.activeId = id;
      }
    },
    updateAccount(state, action) {
      const { id, patch } = action.payload;
      const idx = state.list.findIndex((a) => a.id === id);
      if (idx >= 0) state.list[idx] = { ...state.list[idx], ...patch };
    },
    removeAccount(state, action) {
      const id = action.payload;
      state.list = state.list.filter((a) => a.id !== id);
      if (state.activeId === id) {
        state.activeId = state.list[0]?.id || null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateAccounts.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(hydrateAccounts.fulfilled, (state, action) => {
        state.list = action.payload.list;
        state.activeId = action.payload.activeId;
        state.status = "ready";
      })
      .addCase(hydrateAccounts.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error?.message || "Failed to load accounts";
      });
  },
});

export const { addAccount, setActive, updateAccount, removeAccount } = slice.actions;

// Thunk wrappers that persist after each mutation.
export const addAccountAndPersist = (account) => async (dispatch, getState) => {
  dispatch(addAccount(account));
  await persist(getState().accounts);
};

export const setActiveAndPersist = (id) => async (dispatch, getState) => {
  dispatch(setActive(id));
  await persist(getState().accounts);
};

export const updateAccountAndPersist = (id, patch) => async (dispatch, getState) => {
  dispatch(updateAccount({ id, patch }));
  await persist(getState().accounts);
};

// Best-effort: tell the account's server to stop pushing to this device, so a
// signed-out account's notifications don't keep arriving. Must run BEFORE the
// client/token are dropped. Capped by a short timeout and every error is
// swallowed -- sign-out must never hang or fail on this (e.g. a revoked
// session's 401 just fails silently here).
const PUSH_UNREGISTER_TIMEOUT_MS = 3000;
async function unregisterPush(id, getState) {
  try {
    const pushToken = await makeAccountStorage(id).getItem(PUSH_TOKEN_KEY);
    if (!pushToken) return;
    let client = getCachedClient(id);
    if (!client) {
      const account = getState().accounts.list.find((a) => a.id === id);
      if (!account) return;
      client = ensureClient(account);
    }
    await Promise.race([
      client.http.post("/push/unregister", { token: pushToken }),
      new Promise((resolve) => setTimeout(resolve, PUSH_UNREGISTER_TIMEOUT_MS)),
    ]);
  } catch {
    // ignore -- best-effort
  }
}

// Re-entry guard: the unregister call above can itself 401 (revoked session),
// which fires onUnauthorized -> signOutAccount(id) again mid-sign-out.
const signingOut = new Set();

export const signOutAccount = (id) => async (dispatch, getState) => {
  if (signingOut.has(id)) return;
  signingOut.add(id);
  try {
    await unregisterPush(id, getState);
    forgetClient(id);
    await purgeAccountStorage(id);
    // Don't leave the signed-out account's media behind: restricted images sit
    // in expo-image's disk/memory cache, and its audio may still be playing or
    // queued in the global player. The image cache is app-wide (not
    // per-account), so this also clears other accounts' cache -- it just
    // re-downloads.
    stopGlobalAudio();
    try { Image.clearMemoryCache(); } catch {}
    await Image.clearDiskCache().catch(() => {});
    dispatch(removeAccount(id));
    await persist(getState().accounts);
  } finally {
    signingOut.delete(id);
  }
};

// Selectors
export const selectAccounts = (s) => s.accounts.list;
export const selectActiveId = (s) => s.accounts.activeId;
export const selectActiveAccount = (s) =>
  s.accounts.list.find((a) => a.id === s.accounts.activeId) || null;
export const selectAccountsStatus = (s) => s.accounts.status;

export default slice.reducer;
