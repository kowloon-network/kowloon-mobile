// Feed data hook — loads posts for the active filter selection.
//
// `viewKey` chooses the source:
//   "all" (or any non-subject key) → GET /posts   (merged public + server for
//                                     authed users, page-based)
//   "circle:<id>@..."  → GET /circles/:id/posts  (circle posts,    cursor-based)
//   "group:<id>@..."   → GET /groups/:id/posts   (group posts,     page-based)
//
// `activeTypes` filters by post type (empty = all types).
// `accountId`   scopes the local cache key so multi-account installs don't mix.
//
// Cache strategy (stale-while-revalidate):
//   On mount, the last 20 posts for this viewKey are read from AsyncStorage
//   and shown immediately. The normal network fetch runs in parallel and
//   replaces them when it lands. After every successful initial/refresh fetch
//   the cache is overwritten with the new first page.
//
// When `viewKey` or `activeTypes` changes the feed resets to page 1.

import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useActiveClient } from "./useActiveClient.js";

// ---- Cache helpers ----------------------------------------------------------

const CACHE_LIMIT = 20;

function cacheKey(accountId, viewKey) {
  if (!accountId || !viewKey) return null;
  return `kowloon:${accountId}:feedCache:${viewKey}`;
}

async function readCache(key) {
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeCache(key, posts) {
  if (!key || !posts?.length) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(posts.slice(0, CACHE_LIMIT)));
  } catch {
    // Non-fatal — cache miss on next open is the worst outcome.
  }
}

// ---- Feed helpers -----------------------------------------------------------

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

function isCircle(viewKey) {
  return typeof viewKey === "string" && viewKey.startsWith("circle:");
}

function isGroup(viewKey) {
  return typeof viewKey === "string" && viewKey.startsWith("group:");
}

// ---- Hook ------------------------------------------------------------------

// `enabled` (default true): callers pass false until their filter state has
// hydrated, so we don't fire a throwaway "all" fetch that races the real view.
export function useFeed({ viewKey = "public", activeTypes = [], accountId, enabled = true } = {}) {
  const client = useActiveClient();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Pagination cursor — meaning depends on the current view:
  //   server feeds → integer page number of last loaded page
  //   circle feeds → ISO `publishedAt` of the oldest loaded item, used as `before`
  const cursor = useRef(null);
  const inFlight = useRef(false);
  // Request generation: every fetch takes a new number; a response is only
  // applied if it is still the latest AND was made for the view/client that is
  // current now. Without this, a slow response for a previous view (cold-start
  // "all" fetch, or account A after switching to B) landed in the new view.
  const generation = useRef(0);

  // Active-types JSON for the effect dep (arrays aren't ref-stable).
  const typesKey = JSON.stringify(activeTypes || []);

  // What the hook is showing right now (updated every render), so stale
  // fetchPage closures -- e.g. an old loadMore -- can tell they're outdated.
  const viewSig = `${accountId}|${viewKey}|${typesKey}`;
  const currentRef = useRef(null);
  currentRef.current = { client, viewSig };

  const fetchPage = useCallback(
    async (mode) => {
      if (!client || inFlight.current) return;
      const isCurrent = () =>
        currentRef.current?.client === client &&
        currentRef.current?.viewSig === viewSig;
      if (!isCurrent()) return;
      const myGen = ++generation.current;
      const isLatest = () => myGen === generation.current && isCurrent();
      inFlight.current = true;

      if (mode === "initial") setLoading(true);
      else if (mode === "refresh") setRefreshing(true);
      else if (mode === "more") setLoadingMore(true);
      setError(null);

      try {
        let res;
        let items = [];

        if (isCircle(viewKey)) {
          // Circle feed — cursor-based via `before`.
          const before = mode === "more" ? cursor.current : undefined;
          res = await client.feeds.getCirclePosts({
            circleId: viewKey,
            types: activeTypes,
            before,
          });
          items = res?.orderedItems || res?.items || [];
          if (!isLatest()) return; // superseded -- see `generation`
          const oldest = items[items.length - 1]?.publishedAt;
          cursor.current = oldest || cursor.current;
          // No total available — assume more if we got a full-ish page.
          setHasMore(items.length >= 15);
        } else if (viewKey === "mine") {
          // My Posts — the viewer's own posts across every audience they
          // authored (the server returns all of an author's own posts). Page-based.
          const page =
            mode === "more"
              ? (typeof cursor.current === "number" ? cursor.current : 0) + 1
              : 1;
          res = await client.feeds.getUserPosts({
            userId: accountId,
            // getUserPosts takes a single type; pass it only when exactly one
            // type is active, otherwise fetch all.
            type: activeTypes?.length === 1 ? activeTypes[0] : undefined,
            page,
          });
          items = res?.orderedItems || res?.items || [];
          if (!isLatest()) return; // superseded -- see `generation`
          const totalPages = Number(res?.totalPages);
          setHasMore(totalPages ? page < totalPages : items.length >= 20);
          cursor.current = page;
        } else if (isGroup(viewKey)) {
          // Group feed — page-based. getGroupPosts takes a single `type`,
          // not an array, so when filtering pass the first active type only
          // (the picker is single-select for groups today).
          const page =
            mode === "more"
              ? (typeof cursor.current === "number" ? cursor.current : 0) + 1
              : 1;
          res = await client.feeds.getGroupPosts({
            groupId: viewKey,
            type: activeTypes?.[0],
            page,
          });
          items = res?.orderedItems || res?.items || [];
          if (!isLatest()) return; // superseded -- see `generation`
          const totalPages = Number(res?.totalPages) || 1;
          setHasMore(page < totalPages);
          cursor.current = page;
        } else {
          // "All Posts" — the merged firehose, page-based. Omit `to` so the
          // server returns its default: public + server for authed local users
          // (public only for logged-out / remote). No client-side public vs
          // server split.
          const page =
            mode === "more"
              ? (typeof cursor.current === "number" ? cursor.current : 0) + 1
              : 1;
          res = await client.feeds.getServerPosts({
            types: activeTypes,
            page,
          });
          items = res?.orderedItems || res?.items || [];
          if (!isLatest()) return; // superseded -- see `generation`
          const totalPages = Number(res?.totalPages) || 1;
          setHasMore(page < totalPages);
          cursor.current = page;
        }

        setPosts((prev) =>
          mode === "more" ? dedupeById([...prev, ...items]) : dedupeById(items)
        );

        // Persist first page so the next launch can seed instantly.
        if (mode !== "more") {
          writeCache(cacheKey(accountId, viewKey), items);
        }
      } catch (e) {
        if (!isLatest()) return;
        setError(e?.message || "Couldn't load the feed.");
        // Stop here: without this, a failed fetch leaves hasMore=true, so an
        // empty FlatList keeps firing onEndReached → loadMore → refetch, which
        // flickers the error/empty states. A fresh initial/refresh resets it.
        setHasMore(false);
      } finally {
        // A superseded request must not clear the flags of the one that
        // replaced it (the view-change effect already reset them).
        if (myGen === generation.current) {
          inFlight.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    // typesKey covers activeTypes; viewKey direct; client and accountId identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, viewKey, typesKey, accountId]
  );

  // Reset + load whenever the view or type filter changes (or account
  // changes, since useActiveClient swaps). Seed from cache immediately so
  // there's something to show while the network request runs.
  useEffect(() => {
    cursor.current = null;
    setPosts([]);
    setHasMore(true);
    // Invalidate any request still in flight for the previous view/client and
    // release the single-flight guard so the new view's fetch isn't skipped.
    generation.current++;
    inFlight.current = false;
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);

    if (!client || !enabled) return;

    let cancelled = false;
    readCache(cacheKey(accountId, viewKey)).then((cached) => {
      // Don't let a slow cache read clobber a network result that beat it.
      if (!cancelled && cached?.length) {
        setPosts((prev) => (prev.length ? prev : cached));
      }
    });
    fetchPage("initial");

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, viewKey, typesKey, accountId, enabled]);

  const refresh = useCallback(() => {
    cursor.current = null;
    setHasMore(true);
    return fetchPage("refresh");
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && !refreshing && hasMore) {
      fetchPage("more");
    }
  }, [fetchPage, loading, loadingMore, refreshing, hasMore]);

  const removePost = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return {
    posts,
    loading,
    loadingMore,
    refreshing,
    error,
    refresh,
    loadMore,
    hasMore,
    removePost,
  };
}
