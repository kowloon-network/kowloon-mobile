// Notifications — recent activity from people interacting with your stuff.
//
// Tap a row to mark it read and jump to the source (post, group, etc.). The
// × dismisses. "Mark all read" lives in the header when there are unread
// items. Filter chips toggle the type filter (no server filtering — we just
// hide locally so unfiltered counts stay stable).

import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackLink } from "../../src/components/ui/BackLink.jsx";
import { NotificationRow } from "../../src/components/notifications/NotificationRow.jsx";
import { AppHeader, HeaderButton } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useUnreadCount } from "../../src/lib/UnreadCountContext.js";
import { NOTIF_TYPES, notificationRoute } from "../../src/lib/notifications.js";
import { selectActiveAccount } from "../../src/state/accountsSlice.js";
import { useInk } from "../../src/lib/useInk.js";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "reply", label: "Replies" },
  { key: "react", label: "Reactions" },
  { key: "join_request", label: "Requests" },
  { key: "join_approved", label: "Approvals" },
];

export default function Notifications() {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const { refresh: refreshUnread, setCount: setUnread } = useUnreadCount();
  const ink = useInk();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.notifications.list({ limit: 50 });
        setItems(res?.orderedItems || res?.items || []);
      } catch (e) {
        setError(e?.message || "Couldn't load notifications.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered =
    filter === "all" ? items : items.filter((n) => n?.type === filter);
  const unreadCount = items.filter((n) => !n?.read).length;

  function handleTap(notification) {
    // Optimistic mark-read.
    if (!notification?.read) {
      setItems((arr) =>
        arr.map((n) =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
      setUnread((c) => Math.max(0, c - 1));
      client.notifications
        .markRead(notification.id)
        .catch(() => refreshUnread());
    }
    // Navigate to the source if we can.
    const route = notificationRoute(notification);
    if (route) router.push(route);
  }

  function handleDismiss(notification) {
    const wasUnread = !notification?.read;
    setItems((arr) => arr.filter((n) => n.id !== notification.id));
    if (wasUnread) setUnread((c) => Math.max(0, c - 1));
    client.notifications
      .dismiss(notification.id)
      .catch(() => refreshUnread());
  }

  async function handleMarkAllRead() {
    if (!unreadCount) return;
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await client.notifications.markAllRead({});
    } catch {
      // optimistic stays; pull-to-refresh and the next 60s poll will reconcile
      refreshUnread();
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <HeaderButton label="Mark all read" onPress={handleMarkAllRead} />
          ) : null
        }
      />

      {/* Filter chips */}
      <View className=" ">
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <Pressable
                onPress={() => setFilter(item.key)}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              >
                {/* Background on an inner View so the deselected filter
                    repaints — a bg on the ripple-owning Pressable sticks. */}
                <View
                  className="px-3 py-1.5"
                  style={{ backgroundColor: active ? "#5588B1" : "#F4F4F4" }}
                >
                  <Text
                    className={`font-ui uppercase tracking-[0.14em] text-[11px] ${active ? "font-bold" : ""}`}
                    style={{ color: active ? "#F4F5F7" : ink(0.7) }}
                  >
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        className="flex-1"
        data={filtered}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            baseUrl={account?.baseUrl}
            onPress={() => handleTap(item)}
            onDismiss={() => handleDismiss(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load({ isRefresh: true })}
          />
        }
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
                onPress={() => load()}
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
              <Text className="font-ui text-lg text-base-content/70 text-center mb-2">
                {filter === "all"
                  ? "Nothing here yet."
                  : `No ${NOTIF_TYPES[filter]?.label?.toLowerCase() || filter} notifications.`}
              </Text>
              <Text className="font-ui text-sm text-base-content/55 text-center leading-6">
                When someone replies to or reacts to your posts, you'll see it
                here.
              </Text>
            </View>
          )
        }
      />

    </SafeAreaView>
  );
}
