// Typography preferences — React context.
//
// Holds the active account's reading-typography prefs. Hydrates from
// `user.prefs.typography` when the active account changes, and writes changes
// back to the server (debounced) via @kowloon/client. Screens read prefs
// through the useTypography() hook.
//
// When there is no active account (welcome / login / register screens) the
// context still provides DEFAULT_TYPOGRAPHY so reading surfaces render — it
// just doesn't sync anywhere.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelector } from "react-redux";

import { selectActiveAccount } from "../state/accountsSlice.js";
import { ensureClient, sharedInit } from "./client.js";
import {
  DEFAULT_TYPOGRAPHY,
  normalizeTypography,
  resolveTypography,
} from "./typography.js";

const SYNC_DEBOUNCE_MS = 500;

const TypographyContext = createContext(null);

export function TypographyProvider({ children }) {
  const account = useSelector(selectActiveAccount);
  const [typography, setState] = useState(DEFAULT_TYPOGRAPHY);

  // Debounce timer, the client to sync through, and the latest typography
  // value still awaiting a write. Kept in refs so changing them doesn't
  // re-render or re-fire effects.
  const syncTimer = useRef(null);
  const clientRef = useRef(null);
  const pendingRef = useRef(null);

  // Hydrate whenever the active account changes.
  useEffect(() => {
    let cancelled = false;

    // Flush the previous account's pending write before switching, so it
    // goes to the account it was made on (syncNow uses the captured client).
    syncNow();

    if (!account) {
      clientRef.current = null;
      setState(DEFAULT_TYPOGRAPHY);
      return;
    }

    const client = ensureClient(account);
    clientRef.current = client;

    (async () => {
      let user = client.auth.getUser?.();
      if (!user) {
        // Cold start — restore the session so prefs are available.
        try {
          user = await sharedInit(client);
        } catch {
          user = null;
        }
      }
      if (cancelled) return;
      setState(normalizeTypography(user?.prefs?.typography));
    })();

    return () => {
      cancelled = true;
    };
  }, [account?.id]);

  // Write whatever's pending to the server right now. The server's Update
  // handler replaces the whole `prefs.typography` subdocument, so we always
  // send the complete object, never a partial patch. Non-fatal on failure —
  // the local change still applies and a later change (or next login)
  // reconciles.
  function syncNow() {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    // pendingRef holds { client, value }: the client captured when the change
    // was made, so A's typography is never saved to B after a switch.
    const pending = pendingRef.current;
    if (!pending?.value || !pending.client) return;
    const { client, value } = pending;
    pendingRef.current = null;
    client.activities
      ?.updateProfile({ updates: { prefs: { typography: value } } })
      .catch(() => {});
  }

  // Flush any pending sync when the provider unmounts (app teardown).
  useEffect(() => {
    return () => {
      syncNow();
    };
    // syncNow is stable enough for this teardown-only effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => {
    function setTypography(patch) {
      setState((prev) => {
        const next = normalizeTypography({ ...prev, ...patch });
        if (clientRef.current) {
          pendingRef.current = { client: clientRef.current, value: next };
          if (syncTimer.current) clearTimeout(syncTimer.current);
          syncTimer.current = setTimeout(syncNow, SYNC_DEBOUNCE_MS);
        }
        return next;
      });
    }

    return {
      typography,
      resolved: resolveTypography(typography),
      setTypography,
      // Force an immediate write of any pending change — used by the
      // settings screen's "Done" button so save is deterministic.
      flushTypography: syncNow,
    };
  }, [typography]);

  return (
    <TypographyContext.Provider value={value}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  const ctx = useContext(TypographyContext);
  if (!ctx) {
    throw new Error("useTypography must be used inside <TypographyProvider>");
  }
  return ctx;
}
