// useStaffRole -- the active account's place on its server's staff:
// "admin", "mod" or null. useIsAdmin / useIsStaff are shorthands.
//
// The server sets `isServerAdmin` / `isServerMod` on the user via /auth/me
// (membership of the circles named in the `adminCircle` / `modCircle`
// settings). The client caches them on `client.auth._user` after session
// restore. On a fresh login that snapshot may not have them yet, so we fall
// back to a one-time /auth/me fetch, cached per ACCOUNT (not per server: two
// accounts on one server can differ) so we don't re-ask on every mount.
//
// What moderators may do is decided on the server
// (server/methods/auth/staffPolicy.js); the app only hides what they can't use.

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useActiveClient } from "./useActiveClient.js";
import { selectActiveId } from "../state/accountsSlice.js";

const cache = new Map(); // accountId -> "admin" | "mod" | null

function roleOf(user) {
  if (!user) return undefined;
  if (typeof user.isServerAdmin !== "boolean") return undefined; // not known yet
  if (user.isServerAdmin) return "admin";
  return user.isServerMod ? "mod" : null;
}

export function useStaffRole() {
  const client = useActiveClient();
  const accountId = useSelector(selectActiveId);

  const known = roleOf(client?.auth?._user);
  const seeded =
    known !== undefined
      ? known
      : accountId && cache.has(accountId)
      ? cache.get(accountId)
      : null;

  const [role, setRole] = useState(seeded);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    const live = roleOf(client.auth?._user);
    if (live !== undefined) {
      if (accountId) cache.set(accountId, live);
      setRole(live);
      return;
    }
    if (accountId && cache.has(accountId)) {
      setRole(cache.get(accountId));
      return;
    }
    // Unknown -- ask the server once.
    client.http
      .get("/auth/me")
      .then((res) => {
        const v = roleOf({ isServerAdmin: !!res?.user?.isServerAdmin, isServerMod: !!res?.user?.isServerMod });
        if (accountId) cache.set(accountId, v);
        if (!cancelled) setRole(v);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [client, accountId]);

  return role;
}

export function useIsAdmin() {
  return useStaffRole() === "admin";
}

// Admin or moderator: may open the admin section.
export function useIsStaff() {
  return !!useStaffRole();
}

// Admin sections a moderator can open (app routes under /admin).
export const MOD_ADMIN_ROUTES = new Set([
  "/admin",
  "/admin/moderation",
  "/admin/users",
  "/admin/circles",
  "/admin/pages",
  "/admin/bookmarks",
]);
