// Home feed — the active account's post timeline.
//
// Posts load page by page via useFeed (GET /posts through @kowloon/client).
// Cards show previews only; tapping a card opens the post detail screen.

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PostCard } from "../../src/components/posts/PostCard.jsx";
import { Avatar } from "../../src/components/posts/Avatar.jsx";
import { FeedHeader } from "../../src/components/posts/FeedHeader.jsx";
import { UserMenu } from "../../src/components/UserMenu.jsx";
import { LeftDrawer } from "../../src/components/drawer/LeftDrawer.jsx";
import { TabletColumns } from "../../src/components/layout/TabletColumns.jsx";
import { ComposeFab } from "../../src/components/nav/ComposeFab.jsx";
import { FeedDiscoverRow } from "../../src/components/discover/FeedDiscoverRow.jsx";
import { Globe, Search } from "lucide-react-native";
import { useFeed } from "../../src/lib/useFeed.js";
import { consumeFeedRefresh } from "../../src/lib/feedRefreshSignal.js";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useUnreadCount } from "../../src/lib/UnreadCountContext.js";
import { usePersistedFilter } from "../../src/lib/usePersistedFilter.js";
import { resolveImageUrl } from "../../src/lib/resolveImageUrl.js";
import {
  selectActiveAccount,
  updateAccountAndPersist,
} from "../../src/state/accountsSlice.js";

// Order-independent equality for the active-types array ([] === "all").
function sameTypes(a, b) {
  const x = [...(a || [])].sort();
  const y = [...(b || [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

export default function Feed() {
  const router = useRouter();
  const dispatch = useDispatch();
  const account = useSelector(selectActiveAccount);
  const client = useActiveClient();
  const { count: unreadCount } = useUnreadCount();
  const params = useLocalSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [discoverTick, setDiscoverTick] = useState(0);
  const [serverIcon, setServerIcon] = useState(null);
  // Override the persisted view once when arriving via /feed?view=<key>
  // (e.g. tapping "View posts" on a circle or group detail screen).
  const viewOverrideRef = useRef(null);
  const listRef = useRef(null);
  const backgroundedAtRef = useRef(null);

  // User's server-side filter defaults — used as the fallback for
  // usePersistedFilter on a fresh device (where AsyncStorage is empty for
  // this account). Loaded once when the client is ready.
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      let user = client.auth?.getUser?.();
      if (!user) {
        try {
          user = await client.init();
        } catch {
          user = null;
        }
      }
      if (!cancelled) setPrefs(user?.prefs || {});
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Server icon for the masthead drawer toggle.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds
      .getServerInfo()
      .then((info) => {
        if (cancelled || !info?.icon) return;
        setServerIcon(resolveImageUrl(info.icon, client?.http?.baseUrl));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  const fallbackDefaults = prefs
    ? {
        viewKey: prefs.defaultFeedView || "",
        activeTypes: Array.isArray(prefs.defaultPostView)
          ? prefs.defaultPostView
          : [],
      }
    : undefined;

  // Persisted filter state — viewKey (public/server/circleId/groupId) +
  // activeTypes. Falls back to the user's saved server-side defaults on first
  // hydration.
  const {
    hydrated,
    viewKey,
    setViewKey,
    activeTypes,
    setActiveTypes,
    defaultView,
    defaultTypes,
    saveDefaultView,
    saveDefaultTypes,
  } = usePersistedFilter(account?.id, fallbackDefaults);

  // If we arrived via `?view=...` (e.g. "View Feed" on a circle/group), apply
  // it once. Gate on `hydrated` so the override runs AFTER the persisted-filter
  // AsyncStorage read — otherwise that late read overwrites viewKey with the
  // last-saved view and the requested one never sticks.
  useEffect(() => {
    if (!hydrated) return;
    const requested = typeof params.view === "string" ? params.view : null;
    if (!requested) return;
    if (viewOverrideRef.current === requested) return;
    viewOverrideRef.current = requested;
    if (requested !== viewKey) setViewKey(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.view, hydrated]);

  // Changing the view/filter is ephemeral — it no longer touches the saved
  // default. Only the explicit "set as default" actions persist.
  function handleViewChange(v) {
    setViewKey(v);
  }

  function handleSetTypes(types) {
    setActiveTypes(types);
  }

  // Explicit, independent "set current as default": persists locally (via the
  // hook) and to server prefs so it follows the account across devices. Each
  // axis writes only its own pref (the Update handler merges prefs).
  function handleSetDefaultView() {
    const v = saveDefaultView();
    client?.activities
      ?.updateProfile({ updates: { prefs: { defaultFeedView: v } } })
      .catch(() => {});
  }

  function handleSetDefaultTypes() {
    const t = saveDefaultTypes();
    client?.activities
      ?.updateProfile({ updates: { prefs: { defaultPostView: t } } })
      .catch(() => {});
  }

  const isViewDefault = viewKey === defaultView;
  const isTypesDefault = sameTypes(activeTypes, defaultTypes);

  const {
    posts,
    loading,
    loadingMore,
    refreshing,
    error,
    refresh,
    loadMore,
    removePost,
  } = useFeed({ viewKey, activeTypes, accountId: account?.id });

  // Backfill the server's display name onto the account the first time we
  // have a client for it. Accounts created before this field existed (and
  // any new login) get it filled in here, cached so later mounts skip it.
  useEffect(() => {
    if (!account || account.serverName || !client) return;
    let cancelled = false;
    client.feeds
      .getServerInfo()
      .then((info) => {
        if (!cancelled && info?.name) {
          dispatch(updateAccountAndPersist(account.id, { serverName: info.name }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account?.id, account?.serverName, client, dispatch]);

  // Refresh on focus ONLY when something explicitly asked for it (e.g. you just
  // composed a post). Returning from a post detail or another tab preserves the
  // timeline and scroll position — no reload, no jump to top.
  useFocusEffect(
    useCallback(() => {
      if (consumeFeedRefresh()) refresh();
    }, [refresh])
  );

  // Resume behavior: a quick app-switch preserves the feed, but coming back
  // after a long time away returns you home (default view + filters, scrolled to
  // top). Cold starts already mount to the default, so this only handles warm
  // resumes past the threshold. Tab switches never background the app, so they
  // never trigger this.
  const RESET_AFTER_MS = 30 * 60 * 1000; // 30 minutes
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        backgroundedAtRef.current = Date.now();
      } else if (next === "active") {
        const since = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (since && Date.now() - since > RESET_AFTER_MS) {
          setViewKey(defaultView);
          setActiveTypes(defaultTypes);
          listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
          refresh();
        }
      }
    });
    return () => sub.remove();
  }, [defaultView, defaultTypes, setViewKey, setActiveTypes, refresh]);

  // Belt-and-suspenders — the / redirect handles the no-account case. Run as
  // an effect so we don't trip React's "setState during render" warning by
  // calling router.replace synchronously in the render path.
  useEffect(() => {
    if (!account) router.replace("/welcome");
  // router is a stable API object, not reactive state — including it causes
  // this effect to re-fire every render and rapid-navigate on iOS dev client.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  if (!account) return null;

  return (
    <View className="flex-1 bg-base-100">
      {/* Masthead — Klein blue. Server icon + name opens the drawer; the
          account avatar opens the account menu. */}
      <SafeAreaView edges={["top"]} className="bg-header">
        <View className="px-5 pt-2 pb-3 flex-row items-center">
          <Pressable
            onPress={() => setDrawerOpen(true)}
            hitSlop={8}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            className="flex-row items-center flex-1 min-w-0 mr-3"
          >
            <View
              className="w-6 h-6 items-center justify-center overflow-hidden mr-2.5"
              style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
            >
              {serverIcon ? (
                <Image
                  source={{ uri: serverIcon }}
                  style={{ width: 24, height: 24 }}
                  resizeMode="cover"
                />
              ) : (
                <Globe size={15} color="#FFFFFF" strokeWidth={1.75} />
              )}
            </View>
            <Text
              className="font-ui text-xl tracking-tight text-header-content flex-1"
              numberOfLines={1}
            >
              {account.serverName || account.server}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/search")}
            hitSlop={8}
            android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
            className="w-9 h-9 items-center justify-center mr-1"
            accessibilityLabel="Search"
          >
            <Search size={20} color="#FFFFFF" strokeWidth={1.9} />
          </Pressable>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
          >
            <View className="relative">
              <Avatar
                actor={{
                  name: account.profile?.name || account.username,
                  icon: account.profile?.icon || null,
                  id: account.id,
                }}
                size={38}
                baseUrl={account.baseUrl}
              />
              {unreadCount > 0 ? (
                <View className="absolute -top-1 -right-1 bg-accent   min-w-[20px] h-5 items-center justify-center px-1">
                  <Text className="font-ui text-[10px] font-bold text-accent-content">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      </SafeAreaView>

      <LeftDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <UserMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />

      <TabletColumns overlay={<ComposeFab />}>
      {/* Filter header — view picker (Public / Server / Circle) + type filter */}
      <FeedHeader
        viewKey={viewKey}
        onViewChange={handleViewChange}
        activeTypes={activeTypes}
        onSetTypes={handleSetTypes}
        isViewDefault={isViewDefault}
        isTypesDefault={isTypesDefault}
        onSetDefaultView={handleSetDefaultView}
        onSetDefaultTypes={handleSetDefaultTypes}
      />

      <FlatList
        ref={listRef}
        className="flex-1"
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard post={item} onDeleted={() => removePost(item.id)} />
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          viewKey === "all" && activeTypes.length === 0 ? (
            <FeedDiscoverRow refreshKey={discoverTick} />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setDiscoverTick((t) => t + 1);
              refresh();
            }}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          loading ? (
            <View className="py-20 items-center">
              <ActivityIndicator />
            </View>
          ) : error ? (
            <View className="px-6 py-20 items-center">
              <Text className="font-ui text-base text-error text-center mb-4">
                {error}
              </Text>
              <Pressable
                onPress={refresh}
                className="  px-5 py-2.5"
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              >
                <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content">
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="px-6 py-20 items-center">
              <Text className="font-ui text-base text-base-content/60 text-center">
                No posts in your feed yet. Pull to refresh.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-6 items-center">
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
      </TabletColumns>
    </View>
  );
}
