// useIsAdmin — is the active account a server admin?
//
// The server sets `isServerAdmin` on the user via /auth/me (membership of the
// circle named in the `adminCircle` setting). The client caches it on
// `client.auth._user` after session restore. On a fresh login that snapshot may
// not have it yet, so we fall back to a one-time /auth/me fetch, cached per
// ACCOUNT (not per server: two accounts on one server can differ in admin
// status) so we don't re-ask on every mount.

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useActiveClient } from "./useActiveClient.js";
import { selectActiveId } from "../state/accountsSlice.js";

const cache = new Map(); // accountId -> boolean

export function useIsAdmin() {
  const client = useActiveClient();
  const accountId = useSelector(selectActiveId);

  const known = client?.auth?._user?.isServerAdmin;
  const seeded =
    typeof known === "boolean"
      ? known
      : accountId && cache.has(accountId)
      ? cache.get(accountId)
      : false;

  const [isAdmin, setIsAdmin] = useState(!!seeded);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    const live = client.auth?._user?.isServerAdmin;
    if (typeof live === "boolean") {
      if (accountId) cache.set(accountId, live);
      setIsAdmin(live);
      return;
    }
    if (accountId && cache.has(accountId)) {
      setIsAdmin(cache.get(accountId));
      return;
    }
    // Unknown — ask the server once.
    client.http
      .get("/auth/me")
      .then((res) => {
        const v = !!res?.user?.isServerAdmin;
        if (accountId) cache.set(accountId, v);
        if (!cancelled) setIsAdmin(v);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [client, accountId]);

  return isAdmin;
}
