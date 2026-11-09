// useJoinedGroups — return the groups the current viewer has joined.
//
// There's no dedicated "my groups" endpoint. Joined groups live as members of
// the user's `circles.groups` system circle. This hook:
//   1. resolves the current user (auth cache → init fallback)
//   2. reads user.circles.groups (a circle ID)
//   3. fetches that circle and returns members whose id starts with "group:"
//
// Members come back as compact subdocs ({ id, name, icon, url }), not full
// Group records — enough for a list display and tap-into-detail.

import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { useActiveClient } from "./useActiveClient.js";
import { sharedInit } from "./client.js";
import { selectActiveAccount } from "../state/accountsSlice.js";

export function useJoinedGroups() {
  const client = useActiveClient();
  // Depend on the active account so this reloads once the session is ready.
  // Without it, an early mount (before auth restores) resolves to [] and never
  // retries, leaving "joined?" checks permanently false.
  const account = useSelector(selectActiveAccount);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setLoading(false);
      else setLoading(true);
      setError(null);
      try {
        // Cached user → cold-start init fallback.
        let user = client.auth?.getUser?.();
        if (!user) {
          try {
            user = await sharedInit(client);
          } catch {
            user = null;
          }
        }
        // Auth payload flattens the user's system-circle IDs to the top of
        // the user object (alongside following / blocked / muted). Fall back
        // to user.circles.groups in case the server ever switches back to
        // the nested shape.
        const groupsCircleId = user?.groups || user?.circles?.groups;
        if (!groupsCircleId) {
          setGroups([]);
          return;
        }
        const circle = await client.feeds.getCircle({
          circleId: groupsCircleId,
        });
        const c = circle?.item || circle?.circle || circle;
        const members = Array.isArray(c?.members) ? c.members : [];
        setGroups(members.filter((m) => m?.id?.startsWith?.("group:")));
      } catch (e) {
        setError(e?.message || "Couldn't load your groups.");
      } finally {
        setLoading(false);
      }
    },
    [client, account?.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { groups, loading, error, refresh: () => load({ isRefresh: true }) };
}
