// useIsAdmin — is the active account a server admin?
//
// The server sets `isServerAdmin` on the user via /auth/me (membership of the
// circle named in the `adminCircle` setting). The client caches it on
// `client.auth._user` after session restore. On a fresh login that snapshot may
// not have it yet, so we fall back to a one-time /auth/me fetch, cached per
// server so we don't re-ask on every mount.

import { useEffect, useState } from "react";
import { useActiveClient } from "./useActiveClient.js";

const cache = new Map(); // baseUrl -> boolean

export function useIsAdmin() {
  const client = useActiveClient();
  const baseUrl = client?.http?.baseUrl;

  const known = client?.auth?._user?.isServerAdmin;
  const seeded =
    typeof known === "boolean"
      ? known
      : baseUrl && cache.has(baseUrl)
      ? cache.get(baseUrl)
      : false;

  const [isAdmin, setIsAdmin] = useState(!!seeded);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    const live = client.auth?._user?.isServerAdmin;
    if (typeof live === "boolean") {
      if (baseUrl) cache.set(baseUrl, live);
      setIsAdmin(live);
      return;
    }
    if (baseUrl && cache.has(baseUrl)) {
      setIsAdmin(cache.get(baseUrl));
      return;
    }
    // Unknown — ask the server once.
    client.http
      .get("/auth/me")
      .then((res) => {
        const v = !!res?.user?.isServerAdmin;
        if (baseUrl) cache.set(baseUrl, v);
        if (!cancelled) setIsAdmin(v);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [client, baseUrl]);

  return isAdmin;
}
