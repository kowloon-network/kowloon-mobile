// Search — local, viewer-scoped search across People, Posts, Groups, and
// Bookmarks. The server gates every result through the same visibility rules as
// the timeline (see server routes/search). Bookmarks are personal: that tab
// only ever surfaces your own saved bookmarks.
//
// "All" shows a few of each type with a "See all" jump; each type tab is a
// paginated list. Matching is whole-word (Mongo $text) for now — prefix /
// wildcard search is a later enhancement.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Globe, Search as SearchIcon, X } from "lucide-react-native";

import { BackLink } from "../../src/components/ui/BackLink.jsx";
import { Avatar } from "../../src/components/posts/Avatar.jsx";
import { PostCard } from "../../src/components/posts/PostCard.jsx";
import { GroupCard } from "../../src/components/groups/GroupCard.jsx";
import { BookmarkCard } from "../../src/components/bookmarks/BookmarkCard.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { TabletColumns } from "../../src/components/layout/TabletColumns.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { selectActiveAccount } from "../../src/state/accountsSlice.js";
import { resolveImageUrl } from "../../src/lib/resolveImageUrl.js";
import { useInk } from "../../src/lib/useInk.js";

const MIN_QUERY = 2;
const ALL_PREVIEW = 4; // results shown per type on the "All" tab

// Tab order. "all" is a grouped overview; the rest are single-type lists.
const TABS = [
  { key: "all", label: "All" },
  { key: "users", label: "People" },
  { key: "posts", label: "Posts" },
  { key: "groups", label: "Groups" },
  { key: "bookmarks", label: "Bookmarks" },
];

// Run a single-type search via the client's convenience methods.
function searchByType(client, type, query, page) {
  switch (type) {
    case "users":
      return client.search.searchUsers({ query, page });
    case "posts":
      return client.search.searchPosts({ query, page });
    case "groups":
      return client.search.searchGroups({ query, page });
    case "bookmarks":
      return client.search.searchBookmarks({ query, page });
    default:
      return Promise.resolve({ orderedItems: [], totalItems: 0 });
  }
}

const itemsOf = (res) => res?.orderedItems || res?.items || [];

export default function Search() {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const ink = useInk();

  const { q: initialQuery } = useLocalSearchParams();
  const [query, setQuery] = useState(initialQuery || "");
  const [debounced, setDebounced] = useState((initialQuery || "").trim());
  const [tab, setTab] = useState("all");

  // "All" tab: a few of each type. Type tabs: a paginated flat list.
  const [sections, setSections] = useState({ users: [], posts: [], groups: [], bookmarks: [] });
  // Partial cached-server matches (any known server whose domain/name contains
  // the query) — distinct from the exact @domain live lookup below.
  const [serverMatches, setServerMatches] = useState([]);
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Debounce the raw input → debounced query that actually drives fetches.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const tooShort = debounced.length > 0 && debounced.length < MIN_QUERY;
  const ready = !!client && debounced.length >= MIN_QUERY;

  // Server lookup: query is @domain (starts with @, no second @)
  const isServerQuery =
    debounced.startsWith("@") && !debounced.slice(1).includes("@") && debounced.length > 1;

  const [serverResult, setServerResult] = useState(null);
  const [serverLoading, setServerLoading] = useState(false);

  useEffect(() => {
    if (!client || !isServerQuery) {
      setServerResult(null);
      return;
    }
    const domain = debounced.slice(1);
    let cancelled = false;
    setServerLoading(true);
    client.feeds
      .getServer({ domain })
      .then((res) => { if (!cancelled) setServerResult(res); })
      .catch(() => { if (!cancelled) setServerResult(null); })
      .finally(() => { if (!cancelled) setServerLoading(false); });
    return () => { cancelled = true; };
  }, [client, debounced, isServerQuery]);

  // Primary fetch — re-runs whenever the query or active tab changes.
  useEffect(() => {
    if (!client) return;
    if (debounced.length < MIN_QUERY) {
      setSections({ users: [], posts: [], groups: [], bookmarks: [] });
      setServerMatches([]);
      setList([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (tab === "all") {
          const [u, p, g, b, s] = await Promise.all([
            searchByType(client, "users", debounced, 1),
            searchByType(client, "posts", debounced, 1),
            searchByType(client, "groups", debounced, 1),
            searchByType(client, "bookmarks", debounced, 1),
            client.search.searchServers({ query: debounced, page: 1 }),
          ]);
          if (cancelled) return;
          setSections({
            users: itemsOf(u),
            posts: itemsOf(p),
            groups: itemsOf(g),
            bookmarks: itemsOf(b),
          });
          setServerMatches(itemsOf(s));
        } else {
          const res = await searchByType(client, tab, debounced, 1);
          if (cancelled) return;
          setList(itemsOf(res));
          setTotal(res?.totalItems ?? itemsOf(res).length);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Search failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, debounced, tab]);

  const hasMore = tab !== "all" && list.length < total;

  const loadMore = useCallback(async () => {
    if (!ready || tab === "all" || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await searchByType(client, tab, debounced, next);
      const more = itemsOf(res);
      setList((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...more.filter((x) => !seen.has(x.id))];
      });
      setTotal(res?.totalItems ?? total);
      setPage(next);
    } catch {
      // keep what we have; a failed page just stops the scroll
    } finally {
      setLoadingMore(false);
    }
  }, [client, debounced, tab, page, total, hasMore, loadingMore, ready]);

  function openItem(type, item) {
    if (type === "users") router.push(`/user/${encodeURIComponent(item.id)}`);
    else if (type === "posts") router.push(`/post/${encodeURIComponent(item.id)}`);
    else if (type === "groups") router.push(`/group/${encodeURIComponent(item.id)}`);
    // bookmarks open their href directly via BookmarkCard
  }

  const renderItem = useCallback(
    (type, item) => {
      if (type === "users") {
        return (
          <UserResultRow
            user={item}
            baseUrl={account?.baseUrl}
            onPress={() => openItem("users", item)}
          />
        );
      }
      if (type === "posts") return <PostCard post={item} />;
      if (type === "groups") {
        return (
          <GroupCard
            group={item}
            serverDomain={account?.server}
            baseUrl={account?.baseUrl}
            onPress={() => openItem("groups", item)}
          />
        );
      }
      if (type === "bookmarks") {
        return <BookmarkCard bookmark={item} baseUrl={account?.baseUrl} />;
      }
      return null;
    },
    // openItem is stable enough (only reads router/account)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account?.baseUrl, account?.server]
  );

  // Servers shown on the "All" tab: the exact @domain live lookup first, then
  // any partial cached-server matches, deduped by domain.
  const serverList = useMemo(() => {
    const out = [];
    const seen = new Set();
    if (serverResult?.domain) {
      out.push(serverResult);
      seen.add(serverResult.domain.toLowerCase());
    }
    for (const s of serverMatches) {
      const d = (s?.domain || "").toLowerCase();
      if (!d || seen.has(d)) continue;
      seen.add(d);
      out.push(s);
    }
    return out;
  }, [serverResult, serverMatches]);

  const allEmpty =
    serverList.length === 0 &&
    sections.users.length === 0 &&
    sections.posts.length === 0 &&
    sections.groups.length === 0 &&
    sections.bookmarks.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader title="Search" />
      <TabletColumns>
      {/* Search field */}
      <View className="px-5 pt-3 pb-3  ">
        <View className="flex-row items-center   bg-field px-3">
          <SearchIcon size={16} color={ink(0.45)} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people, posts, groups... or @domain"
            placeholderTextColor={ink(0.35)}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 py-3 px-2 font-ui text-base text-base-content"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
              android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
            >
              <X size={16} color={ink(0.5)} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Tabs — horizontally scrollable */}
      <View className=" ">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {TABS.map((t) => (
            <TabButton
              key={t.key}
              label={t.label}
              active={tab === t.key}
              onPress={() => setTab(t.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Body */}
      <View className="flex-1">
      {debounced.length === 0 ? (
        <Hint primary="Find people, posts, groups, and your bookmarks." secondary={"Type at least two letters to begin.\nType @domain to look up another server."} />
      ) : tooShort ? (
        <Hint primary="Keep typing..." secondary="Searches start at two letters." />
      ) : loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="px-6 py-20 items-center">
          <Text className="font-ui text-base text-error text-center mb-4">
            {error}
          </Text>
        </View>
      ) : tab === "all" ? (
        allEmpty ? (
          <NoResults query={debounced} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Servers — exact @domain lookup plus any partial cached matches */}
            {(serverList.length > 0 || serverLoading) ? (
              <View>
                <SectionHeader
                  title={serverList.length > 1 ? "Servers" : "Server"}
                  showSeeAll={false}
                />
                {serverLoading && serverList.length === 0 ? (
                  <View className="px-5 py-4">
                    <ActivityIndicator />
                  </View>
                ) : (
                  serverList.map((s) => (
                    <ServerResultCard
                      key={s.domain}
                      server={s}
                      baseUrl={account?.baseUrl}
                      onPress={() => {
                        if (s?.domain) router.push(`/server/${encodeURIComponent(s.domain)}`);
                      }}
                    />
                  ))
                )}
              </View>
            ) : null}
            {TABS.filter((t) => t.key !== "all").map((t) => {
              const items = sections[t.key];
              if (!items || items.length === 0) return null;
              return (
                <View key={t.key}>
                  <SectionHeader
                    title={t.label}
                    showSeeAll={items.length > ALL_PREVIEW}
                    onSeeAll={() => setTab(t.key)}
                  />
                  {items.slice(0, ALL_PREVIEW).map((item) => (
                    <View key={item.id}>{renderItem(t.key, item)}</View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )
      ) : list.length === 0 ? (
        <NoResults query={debounced} />
      ) : (
        <FlatList
          className="flex-1"
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderItem(tab, item)}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-6 items-center">
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}
      </View>
      </TabletColumns>

    </SafeAreaView>
  );
}

// ── Server result card ───────────────────────────────────────────────────────
function ServerResultCard({ server, baseUrl, onPress }) {
  const [iconFailed, setIconFailed] = useState(false);
  const iconSrc = resolveImageUrl(server?.icon, baseUrl);
  const domain = server?.domain || "";
  const name = server?.name || domain;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-center px-5 py-4   bg-base-100"
    >
      {iconSrc && !iconFailed ? (
        <Image
          source={{ uri: iconSrc }}
          style={{ width: 44, height: 44 }}
          className="  bg-base-200"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <View
          style={{ width: 44, height: 44 }}
          className="  bg-secondary items-center justify-center"
        >
          <Globe size={20} color="rgba(255,244,224,0.7)" strokeWidth={1.75} />
        </View>
      )}
      <View className="flex-1 ml-3 min-w-0">
        <Text
          className="font-ui text-lg text-base-content leading-tight"
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/50 mt-0.5"
          numberOfLines={1}
        >
          {domain}
          {typeof server?.userCount === "number"
            ? `  ·  ${server.userCount.toLocaleString()} users`
            : ""}
        </Text>
        {server?.description ? (
          <Text
            className="font-ui text-xs text-base-content/70 leading-snug mt-1"
            numberOfLines={2}
          >
            {server.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── User result row ─────────────────────────────────────────────────────────
// Search returns a lean user shape: { id, username, profile: { name, icon }, url }.
function UserResultRow({ user, baseUrl, onPress }) {
  const name = user?.profile?.name || user?.username || user?.id;
  const actor = { id: user?.id, name, icon: user?.profile?.icon || null };
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-center px-5 py-4   bg-base-100"
    >
      <Avatar actor={actor} size={44} baseUrl={baseUrl} />
      <View className="flex-1 ml-3 min-w-0">
        <Text
          className="font-ui text-lg text-base-content leading-tight"
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          className="font-ui text-xs text-base-content/55 mt-0.5"
          numberOfLines={1}
        >
          {user?.id}
        </Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({ title, showSeeAll, onSeeAll }) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-5 pb-2 bg-base-100">
      <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/55">
        {title}
      </Text>
      {showSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        >
          <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary">
            See all
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className={`px-4 py-3 items-center ${
        active ? "  -mb-[2px]" : ""
      }`}
    >
      <Text
        className={`font-ui uppercase tracking-[0.16em] text-[11px] ${
          active ? "text-base-content font-bold" : "text-base-content/50"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Hint({ primary, secondary }) {
  return (
    <View className="px-8 py-20 items-center">
      <Text className="font-ui text-lg text-base-content/70 text-center mb-2">
        {primary}
      </Text>
      <Text className="font-ui text-sm text-base-content/55 text-center leading-6">
        {secondary}
      </Text>
    </View>
  );
}

function NoResults({ query }) {
  return (
    <View className="px-8 py-20 items-center">
      <Text className="font-ui text-lg text-base-content/70 text-center mb-2">
        No results for "{query}".
      </Text>
      <Text className="font-ui text-sm text-base-content/55 text-center leading-6">
        Try a different word. Search matches whole words for now.
      </Text>
    </View>
  );
}
