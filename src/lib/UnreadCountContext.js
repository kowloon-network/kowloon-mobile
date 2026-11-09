// Unread notification count — one foreground poll for the whole app.
//
// A single context provider mounted near the root of the app polls the
// server's unreadCount endpoint every POLL_INTERVAL_MS while the app is in
// the foreground. Consumers (the feed masthead badge, the user-menu row, the
// notifications screen) read the count from context and call `refresh()`
// after actions that should invalidate it (mark-read, dismiss, etc.).
//
// Pauses cleanly when the app backgrounds; resumes + immediately refetches
// when it foregrounds. Resets to 0 when there is no active account.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useSelector } from "react-redux";

import { useActiveClient } from "./useActiveClient.js";
import { selectActiveAccount } from "../state/accountsSlice.js";

const POLL_INTERVAL_MS = 60_000;

const UnreadCountContext = createContext({
  count: 0,
  refresh: () => {},
  setCount: () => {},
});

export function UnreadCountProvider({ children }) {
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const [count, setCountState] = useState(0);
  const timerRef = useRef(null);
  // Latest active account id, read after the await below so a count fetched
  // for account A is dropped if the user switched to B while it was in flight.
  const activeIdRef = useRef(account?.id);
  activeIdRef.current = account?.id;

  const refresh = useCallback(async () => {
    if (!client || !account?.id) {
      setCountState(0);
      return;
    }
    const requestedFor = account.id;
    try {
      const res = await client.notifications.unreadCount();
      if (activeIdRef.current !== requestedFor) return;
      const n = Number(res?.count) || 0;
      setCountState(n);
    } catch {
      // non-fatal — keep the previous count
    }
  }, [client, account?.id]);

  // Manual override (e.g. after mark-all-read locally, decrement on dismiss).
  const setCount = useCallback((next) => {
    setCountState(typeof next === "function" ? next : Math.max(0, Number(next) || 0));
  }, []);

  // Reset whenever the active account changes.
  useEffect(() => {
    setCountState(0);
  }, [account?.id]);

  // Foreground polling: kick a poll now, schedule the next, and tear down on
  // unmount or background.
  useEffect(() => {
    if (!client || !account?.id) return;

    let cancelled = false;
    refresh();

    function start() {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!cancelled) refresh();
      }, POLL_INTERVAL_MS);
    }
    function stop() {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }

    start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        start();
      } else {
        stop();
      }
    });

    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [client, account?.id, refresh]);

  return (
    <UnreadCountContext.Provider value={{ count, refresh, setCount }}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount() {
  return useContext(UnreadCountContext);
}
