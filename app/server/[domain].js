import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { useSelector } from "react-redux";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronRight, Globe, MapPin, Newspaper, Play, PlusCircle, Users, X } from "lucide-react-native";
import { selectActiveAccount } from "../../src/state/accountsSlice.js";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { PostCard } from "../../src/components/posts/PostCard.jsx";
import { RecShelf } from "../../src/components/discover/RecShelf.jsx";
import { DiscoverMediaTile } from "../../src/components/discover/DiscoverMediaTile.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { resolveImageUrl } from "../../src/lib/resolveImageUrl.js";

const TABS = [
  { key: "posts",    label: "Public Posts" },
  { key: "circles",  label: "Circles"      },
  { key: "groups",   label: "Groups"       },
  { key: "pages",    label: "Pages"        },
  { key: "discover", label: "Discover"     },
];

const POSTS_PER_PAGE = 20;

// "Popular Media" — a headline plus a horizontally-scrollable strip of the
// server's Discover media (4 across, gapless), ending in a "Discover More" tile
// that jumps to the Discover tab. Each thumbnail opens its original post.
function MediaStrip({ items, baseUrl, onDiscoverMore }) {
  const size = Dimensions.get("window").width / 4;
  if (!items?.length) return null;
  return (
    <View className="pb-1">
      <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content/55 px-5 pt-1 pb-2">
        Popular Media
      </Text>
      <FlatList
        data={items}
        keyExtractor={(it, i) => `${it.id}:${i}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <DiscoverMediaTile item={item} size={size} baseUrl={baseUrl} />
        )}
        ListFooterComponent={
          onDiscoverMore ? (
            <Pressable
              onPress={onDiscoverMore}
              style={{ width: size, height: size }}
              className="bg-secondary items-center justify-center px-2"
              android_ripple={{ color: "rgba(255,255,255,0.12)" }}
            >
              <ChevronRight size={22} color="rgba(255,244,224,0.95)" strokeWidth={2} />
              <Text className="font-ui uppercase tracking-[0.12em] text-[9px] text-secondary-content text-center mt-1" numberOfLines={2}>
                Discover More
              </Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBar({ tab, onSelect }) {
  const scrollRef = useRef(null);
  const layouts = useRef({}); // key -> { x, width }
  const scrollX = useRef(0);
  const viewportW = useRef(0);

  // When the selected tab changes, scroll it fully into view if it's clipped.
  useEffect(() => {
    const l = layouts.current[tab];
    if (!l || !scrollRef.current) return;
    const PAD = 16;
    const vw = viewportW.current || Dimensions.get("window").width;
    const left = l.x;
    const right = l.x + l.width;
    let target = null;
    if (left < scrollX.current + PAD) target = Math.max(0, left - PAD);
    else if (right > scrollX.current + vw - PAD) target = right - vw + PAD;
    if (target != null) scrollRef.current.scrollTo({ x: target, animated: true });
  }, [tab]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      onLayout={(e) => { viewportW.current = e.nativeEvent.layout.width; }}
      onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
      scrollEventThrottle={16}
      className=" "
    >
      {TABS.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onSelect(t.key)}
          onLayout={(e) => { layouts.current[t.key] = e.nativeEvent.layout; }}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          className={`px-4 py-3 ${tab === t.key ? "  -mb-[2px]" : ""}`}
        >
          <Text
            className={`font-ui uppercase tracking-[0.16em] text-[11px] ${
              tab === t.key ? "text-base-content font-bold" : "text-base-content/50"
            }`}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SectionHeading({ children }) {
  return (
    <Text className="font-ui text-[11px] uppercase tracking-[0.18em] text-base-content/50 mb-2 mt-6 px-5">
      {children}
    </Text>
  );
}

function StatPill({ label, value }) {
  if (value == null) return null;
  return (
    <View className="mr-5">
      <Text className="font-ui text-xl text-base-content leading-tight">
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
      <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/50">
        {label}
      </Text>
    </View>
  );
}

function ItemAvatar({ item, baseUrl, size = 36 }) {
  const [failed, setFailed] = useState(false);
  const src = resolveImageUrl(item?.icon, baseUrl);
  if (src && !failed) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size }}
        className="  bg-base-200"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size }}
      className="  bg-secondary items-center justify-center"
    >
      <Users size={size * 0.45} color="rgba(255,244,224,0.7)" strokeWidth={1.75} />
    </View>
  );
}

function CachedRow({ item, baseUrl }) {
  return (
    <View className="flex-row items-center py-3 px-5  ">
      <ItemAvatar item={item} baseUrl={baseUrl} />
      <View className="flex-1 ml-3 min-w-0">
        <Text className="font-ui text-base text-base-content leading-tight" numberOfLines={1}>
          {item.name}
        </Text>
        {typeof item.memberCount === "number" ? (
          <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/50 mt-0.5">
            {item.memberCount.toLocaleString()} members
          </Text>
        ) : null}
        {item.summary ? (
          <Text className="font-ui text-xs text-base-content/70 leading-snug mt-1" numberOfLines={2}>
            {stripHtml(item.summary)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PageRow({ page, domain }) {
  // Open the page IN-APP: we know the server (domain) and these are Kowloon
  // pages, so route to the viewer with ?domain= (our server hydrates the remote
  // page). Fall back to the browser only if we can't derive a slug.
  const openPage = () => {
    const m = (page.url || "").match(/\/pages\/([^/?#]+)/);
    const slug = page.slug || (m ? decodeURIComponent(m[1]) : null);
    if (slug && domain) {
      router.push(
        `/pages/${encodeURIComponent(slug)}?domain=${encodeURIComponent(domain)}`
      );
    } else if (page.url) {
      Linking.openURL(page.url);
    }
  };
  return (
    <Pressable
      onPress={openPage}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-center justify-between py-3 px-5  "
    >
      <Text className="font-ui text-base text-base-content flex-1 mr-3" numberOfLines={1}>
        {page.title}
      </Text>
      <ChevronRight size={16} color="rgba(26,26,32,0.4)" strokeWidth={1.75} />
    </Pressable>
  );
}

function EmptyTab({ message }) {
  return (
    <View className="px-6 py-16 items-center">
      <Text className="font-ui text-base text-base-content/50 text-center">{message}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ServerProfile() {
  const { domain: rawDomain } = useLocalSearchParams();
  const domain = decodeURIComponent(rawDomain || "");
  const client = useActiveClient();
  const baseUrl = client?.http?.baseUrl;
  const account = useSelector(selectActiveAccount);

  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const [tab, setTab] = useState("posts");

  const [recSections, setRecSections] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState(null);
  const [recBg, setRecBg] = useState(null);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(null);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotal, setPostsTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Circle picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerCircles, setPickerCircles] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [addedTo, setAddedTo] = useState(new Set());

  const loadServer = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client || !domain) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setProfileError(null);
      try {
        const res = await client.feeds.getServer({ domain, refresh: isRefresh });
        setServer(res);
      } catch (e) {
        setProfileError(e?.message || "Couldn't load server profile.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client, domain]
  );

  const loadPosts = useCallback(
    async ({ page = 1, append = false } = {}) => {
      if (!domain) return;
      if (append) setLoadingMore(true);
      else setPostsLoading(true);
      setPostsError(null);
      try {
        const qs = `limit=${POSTS_PER_PAGE}${page > 1 ? `&page=${page}` : ""}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`https://${domain}/posts?${qs}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = data.orderedItems ?? data.items ?? [];
        if (append) {
          setPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...items.filter((p) => !seen.has(p.id))];
          });
        } else {
          setPosts(items);
        }
        setPostsTotal(data.totalItems ?? items.length);
        setPostsPage(page);
      } catch (e) {
        setPostsError(e?.message || "Couldn't load posts.");
      } finally {
        setPostsLoading(false);
        setLoadingMore(false);
      }
    },
    [domain]
  );

  // The remote server's own Discover (curated + heuristic), fetched from its
  // public /recommendations — the same shelves a non-member sees there.
  const loadDiscover = useCallback(async () => {
    if (!domain) return;
    setRecLoading(true);
    setRecError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`https://${domain}/recommendations`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecSections(data.sections ?? []);
      setRecBg(data.background ? resolveImageUrl(data.background, `https://${domain}`) : null);
    } catch (e) {
      setRecError(e?.message || "Couldn't load this server's Discover.");
      setRecSections([]);
    } finally {
      setRecLoading(false);
    }
  }, [domain]);

  const openPicker = useCallback(async () => {
    if (!client || !account?.id) return;
    setShowPicker(true);
    if (pickerCircles.length > 0) return;
    setPickerLoading(true);
    try {
      const res = await client.feeds.getUserCircles({ userId: account.id });
      setPickerCircles(res?.orderedItems ?? res?.items ?? []);
    } catch {
      // fail silently — show empty state in the modal
    } finally {
      setPickerLoading(false);
    }
  }, [client, account?.id, pickerCircles.length]);

  const addToCircle = useCallback(async (circleId) => {
    if (!client || addingTo) return;
    setAddingTo(circleId);
    try {
      await client.activities.addToCircle({ circleId, memberId: `@${domain}` });
      setAddedTo((prev) => new Set([...prev, circleId]));
    } catch {
      // leave addedTo unchanged so the user can retry
    } finally {
      setAddingTo(null);
    }
  }, [client, domain, addingTo]);

  // Always load server profile on focus; posts only when Posts tab is active.
  useFocusEffect(
    useCallback(() => {
      loadServer();
    }, [loadServer])
  );

  useEffect(() => {
    if (tab === "posts" && posts.length === 0 && !postsLoading) {
      loadPosts({ page: 1 });
    }
  }, [tab, loadPosts]);

  // Recommendations power both the header media strip (always visible) and the
  // Discover tab, so load them once the server page mounts.
  useEffect(() => {
    if (domain && recSections === null && !recLoading) loadDiscover();
  }, [domain, loadDiscover]);

  const onRefresh = useCallback(() => {
    loadServer({ isRefresh: true });
    if (tab === "posts") loadPosts({ page: 1 });
    if (tab === "discover") loadDiscover();
  }, [loadServer, loadPosts, loadDiscover, tab]);

  if (loading && !server) {
    return (
      <View className="flex-1 bg-base-100 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (profileError && !server) {
    return (
      <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
        <AppHeader back title={domain} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-ui text-base text-error text-center mb-4">{profileError}</Text>
          <Pressable
            onPress={() => loadServer()}
            className="  px-5 py-2.5"
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          >
            <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content">
              Retry
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const heroSrc = resolveImageUrl(server?.image, baseUrl);
  const iconSrc = resolveImageUrl(server?.icon, baseUrl);
  const hasHero = heroSrc && !heroFailed;
  const mediaItems = recSections?.find((s) => s.contentType === "media")?.items?.slice(0, 20) ?? [];
  const circles = server?.cachedCircles ?? [];
  const groups  = server?.cachedGroups  ?? [];
  const pages   = server?.cachedPages   ?? [];
  const hasMore = posts.length < postsTotal;

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title={server?.name || domain} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero */}
        {hasHero ? (
          <Image
            source={{ uri: heroSrc }}
            className="w-full bg-base-200"
            style={{ aspectRatio: 16 / 9 }}
            resizeMode="cover"
            onError={() => setHeroFailed(true)}
          />
        ) : (
          <View className="w-full bg-secondary items-center justify-center" style={{ aspectRatio: 16 / 9 }}>
            {iconSrc ? (
              <Image source={{ uri: iconSrc }} style={{ width: 72, height: 72 }} resizeMode="contain" />
            ) : (
              <Globe size={48} color="rgba(255,244,224,0.5)" strokeWidth={1.5} />
            )}
          </View>
        )}

        {/* Masthead */}
        <View className="px-5 pt-4 pb-3">
          <Text className="font-ui text-3xl text-base-content leading-tight">
            {server?.name || domain}
          </Text>
          <Text className="font-ui text-[11px] uppercase tracking-[0.16em] text-base-content/50 mt-1">
            {domain}
          </Text>

          {server?.stale ? (
            <Text className="font-ui text-xs text-warning mt-1">
              Showing cached data — server unreachable
            </Text>
          ) : null}

          {server?.description ? (
            <Text className="font-ui text-sm text-base-content/80 leading-relaxed mt-3">
              {stripHtml(server.description)}
            </Text>
          ) : null}

          {server?.location?.name ? (
            <View className="flex-row items-center mt-3">
              <MapPin size={13} color="rgba(26,26,32,0.5)" strokeWidth={1.75} />
              <Text className="font-ui text-xs uppercase tracking-[0.14em] text-base-content/50 ml-1.5">
                {server.location.name}
              </Text>
            </View>
          ) : null}

          <View className="flex-row mt-4">
            <StatPill label="Users" value={server?.userCount} />
            <StatPill label="Posts" value={server?.postCount} />
            {server?.openRegistrations != null ? (
              <StatPill
                label="Registration"
                value={server.openRegistrations ? "Open" : "Closed"}
              />
            ) : null}
          </View>

          <Pressable
            onPress={openPicker}
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            className="flex-row items-center self-start   px-4 py-2.5 mt-4"
          >
            <PlusCircle size={14} color="rgba(26,26,32,0.8)" strokeWidth={2} />
            <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content ml-2">
              Add to Circle
            </Text>
          </Pressable>
        </View>

        {/* Popular Media strip — between the masthead and the tabs. */}
        <MediaStrip
          items={mediaItems}
          baseUrl={baseUrl}
          onDiscoverMore={() => setTab("discover")}
        />

        {/* Tab bar */}
        <TabBar tab={tab} onSelect={setTab} />

        {/* Tab content */}
        <View className="pb-10">
          {/* ── Posts ── */}
          {tab === "posts" ? (
            postsLoading ? (
              <View className="py-16 items-center">
                <ActivityIndicator />
              </View>
            ) : postsError ? (
              <View className="px-6 py-16 items-center">
                <Text className="font-ui text-base text-error text-center mb-4">{postsError}</Text>
                <Pressable
                  onPress={() => loadPosts({ page: 1 })}
                  className="  px-5 py-2.5"
                >
                  <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content">
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : posts.length === 0 ? (
              <EmptyTab message="No public posts yet." />
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
                {hasMore ? (
                  <View className="items-center py-6">
                    {loadingMore ? (
                      <ActivityIndicator />
                    ) : (
                      <Pressable
                        onPress={() => loadPosts({ page: postsPage + 1, append: true })}
                        className="  px-6 py-3"
                        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                      >
                        <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content">
                          Load more
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </>
            )
          ) : null}

          {/* ── Discover — the remote server's own curated + heuristic shelves,
                over ITS blurred hero background (differentiates their Discover
                from yours). ── */}
          {tab === "discover" ? (
            <View style={{ position: "relative", minHeight: 520 }} className="bg-[#002FA7]">
              {recBg ? (
                <Image source={{ uri: recBg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : null}
              {recLoading ? (
                <View className="py-16 items-center">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : recError ? (
                <View className="px-6 py-16 items-center">
                  <Text className="font-ui text-base text-white text-center mb-4">{recError}</Text>
                  <Pressable
                    onPress={loadDiscover}
                    className="bg-black/40 px-5 py-2.5"
                    android_ripple={{ color: "rgba(255,255,255,0.1)" }}
                  >
                    <Text className="font-ui uppercase tracking-[0.16em] text-xs text-white">
                      Retry
                    </Text>
                  </Pressable>
                </View>
              ) : !recSections || recSections.length === 0 ? (
                <View className="mx-4 my-4 bg-black/50 px-6 py-16 items-center">
                  <Text className="font-ui text-base text-white/80 text-center">
                    This server hasn't featured anything to discover yet.
                  </Text>
                </View>
              ) : (
                <View className="pt-3 pb-4">
                  {recSections.map((s) => (
                    <RecShelf key={s.id} section={s} baseUrl={baseUrl} onDark />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* ── Circles ── */}
          {tab === "circles" ? (
            circles.length === 0 ? (
              <EmptyTab message="No public circles." />
            ) : (
              <>
                <SectionHeading>Circles</SectionHeading>
                {circles.map((c) => (
                  <CachedRow key={c.id} item={c} baseUrl={baseUrl} />
                ))}
              </>
            )
          ) : null}

          {/* ── Groups ── */}
          {tab === "groups" ? (
            groups.length === 0 ? (
              <EmptyTab message="No public groups." />
            ) : (
              <>
                <SectionHeading>Groups</SectionHeading>
                {groups.map((g) => (
                  <CachedRow key={g.id} item={g} baseUrl={baseUrl} />
                ))}
              </>
            )
          ) : null}

          {/* ── Pages ── */}
          {tab === "pages" ? (
            pages.length === 0 ? (
              <EmptyTab message="No public pages." />
            ) : (
              <>
                <SectionHeading>Pages</SectionHeading>
                {pages.map((p, i) => (
                  <PageRow key={p.url || i} page={p} domain={domain} />
                ))}
              </>
            )
          ) : null}
        </View>
      </ScrollView>
      {/* Circle picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable
          className="flex-1 bg-black/50"
          onPress={() => setShowPicker(false)}
        />
        <View className="bg-base-100   max-h-[60%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-4 pb-3  ">
            <Text className="font-ui text-lg text-base-content">
              Add {domain} to Circle
            </Text>
            <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
              <X size={18} color="rgba(26,26,32,0.7)" strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView>
            {pickerLoading ? (
              <View className="py-10 items-center">
                <ActivityIndicator />
              </View>
            ) : pickerCircles.length === 0 ? (
              <View className="px-6 py-10 items-center">
                <Text className="font-ui text-base text-base-content/55 text-center">
                  No circles yet. Create one first.
                </Text>
              </View>
            ) : (
              pickerCircles.map((circle) => {
                const isAdded = addedTo.has(circle.id);
                const isAdding = addingTo === circle.id;
                return (
                  <Pressable
                    key={circle.id}
                    onPress={() => !isAdded && addToCircle(circle.id)}
                    android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                    className="flex-row items-center justify-between px-5 py-4  "
                  >
                    <View className="flex-1 min-w-0 mr-3">
                      <Text
                        className={`font-ui text-base leading-tight ${isAdded ? "text-base-content/50" : "text-base-content"}`}
                        numberOfLines={1}
                      >
                        {circle.name}
                      </Text>
                      {typeof circle.memberCount === "number" ? (
                        <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/40 mt-0.5">
                          {circle.memberCount.toLocaleString()} members
                        </Text>
                      ) : null}
                    </View>
                    {isAdding ? (
                      <ActivityIndicator size="small" />
                    ) : isAdded ? (
                      <Check size={16} color="rgba(26,26,32,0.5)" strokeWidth={2.5} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
