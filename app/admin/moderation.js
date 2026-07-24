// Admin moderation — the flag queue. Review reported content, then resolve or
// dismiss the flag and optionally remove the content. Flag resolution and
// content removal are two independent steps on the server; "Remove" does both.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, X, ExternalLink, Trash2 } from "lucide-react-native";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";

const STATUSES = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

// Which flagged types can be opened in the app, and where.
const VIEW_ROUTE = {
  Post: (id) => `/post/${encodeURIComponent(id)}`,
  Group: (id) => `/group/${encodeURIComponent(id)}`,
  Circle: (id) => `/circle/${encodeURIComponent(id)}`,
  User: (id) => `/user/${encodeURIComponent(id)}`,
};

// Which flagged types an admin can remove, and how.
const REMOVE = {
  Post: (c, id) => c.admin.deletePost({ postId: id }),
  Page: (c, id) => c.admin.deletePage({ pageId: id }),
  Group: (c, id) => c.admin.deleteGroup({ groupId: id }),
  Circle: (c, id) => c.admin.deleteCircle({ circleId: id }),
  User: (c, id) => c.admin.deleteUser({ userId: id }),
  Bookmark: (c, id) => c.admin.deleteBookmark({ bookmarkId: id }),
};

function reasonLabel(reason) {
  if (!reason) return "Flagged";
  if (typeof reason === "string") return reason;
  return reason.label || reason.name || reason.reason || reason.key || "Flagged";
}

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ActionButton({ label, icon, onPress, disabled, tone = "default" }) {
  const tint =
    tone === "danger"
      ? "text-error"
      : tone === "primary"
      ? "text-primary-content"
      : "text-base-content";
  const bg = tone === "primary" ? "bg-primary" : "bg-base-200";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      className={`flex-row items-center px-3 py-2 ${bg} ${disabled ? "opacity-40" : ""}`}
    >
      {icon}
      <Text className={`font-ui uppercase tracking-[0.12em] text-[10px] ml-1.5 ${tint}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Moderation() {
  const router = useRouter();
  const client = useActiveClient();

  const [status, setStatus] = useState("open");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (nextStatus, { isRefresh = false } = {}) => {
      if (!client) return;
      const s = nextStatus ?? status;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        // getFlagged() drops the status param (client _listParams limitation),
        // so hit the endpoint directly to filter by status.
        const res = await client.admin.http.get("/admin/flagged", {
          params: { status: s },
        });
        setItems(res?.orderedItems || res?.items || []);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load the moderation queue."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client, status]
  );

  useEffect(() => {
    load(status);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolve(flag, newStatus, { notes } = {}) {
    if (busyId) return;
    setBusyId(flag.id);
    try {
      await client.admin.resolveFlag({ flagId: flag.id, status: newStatus, notes });
      setItems((arr) => arr.filter((f) => f.id !== flag.id));
    } catch (e) {
      Alert.alert("Couldn't update", e?.message || "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function confirmRemove(flag) {
    const remover = REMOVE[flag.targetType];
    if (!remover) return;
    Alert.alert(
      `Remove this ${flag.targetType.toLowerCase()}?`,
      "The content will be removed and the report resolved. This can be undone from the admin section.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (busyId) return;
            setBusyId(flag.id);
            try {
              await remover(client, flag.target);
              await client.admin.resolveFlag({
                flagId: flag.id,
                status: "resolved",
                notes: "Content removed",
              });
              setItems((arr) => arr.filter((f) => f.id !== flag.id));
            } catch (e) {
              Alert.alert("Couldn't remove", e?.message || "Please try again.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  const isOpen = status === "open";

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="Moderation" />

      {/* Status tabs */}
      <View className="flex-row border-b border-base-200">
        {STATUSES.map((s) => {
          const active = status === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setStatus(s.key)}
              className={`flex-1 items-center py-3 ${active ? "border-b-2 border-primary" : ""}`}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            >
              <Text
                className={`font-ui uppercase tracking-[0.14em] text-[11px] ${
                  active ? "text-base-content" : "text-base-content/45"
                }`}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(status, { isRefresh: true })}
          />
        }
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="font-ui text-sm text-error px-5 py-6">{error}</Text>
        ) : items.length === 0 ? (
          <View className="px-6 py-20 items-center">
            <Text className="font-ui text-base text-base-content/70 text-center mb-1">
              {isOpen ? "Nothing to review." : `No ${status} reports.`}
            </Text>
            {isOpen ? (
              <Text className="font-ui text-sm text-base-content/45 text-center leading-6">
                Reported posts and users will show up here.
              </Text>
            ) : null}
          </View>
        ) : (
          items.map((flag) => {
            const viewRoute = VIEW_ROUTE[flag.targetType]?.(flag.target);
            const canRemove = !!REMOVE[flag.targetType];
            const busy = busyId === flag.id;
            return (
              <View key={flag.id} className="px-5 py-4 border-b border-base-200">
                <View className="flex-row items-center mb-1.5">
                  <Text className="font-ui text-base font-bold text-base-content flex-1">
                    {reasonLabel(flag.reason)}
                  </Text>
                  {flag.targetType ? (
                    <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45 bg-base-200 px-2 py-0.5">
                      {flag.targetType}
                    </Text>
                  ) : null}
                </View>

                {flag.reason?.description ? (
                  <Text className="font-ui text-xs text-base-content/60 mb-1.5">
                    {flag.reason.description}
                  </Text>
                ) : null}

                <Text className="font-ui text-[11px] text-base-content/45" numberOfLines={1}>
                  {flag.target}
                </Text>
                <Text className="font-ui text-xs text-base-content/50 mt-1">
                  Reported by {flag.actorId} · {timeAgo(flag.createdAt)}
                </Text>
                {flag.notes ? (
                  <Text className="font-ui text-sm text-base-content/70 mt-1.5 italic">
                    "{flag.notes}"
                  </Text>
                ) : null}

                <View className="flex-row flex-wrap items-center mt-3" style={{ gap: 8 }}>
                  {viewRoute ? (
                    <ActionButton
                      label="View"
                      icon={<ExternalLink size={12} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />}
                      onPress={() => router.push(viewRoute)}
                    />
                  ) : null}
                  {isOpen ? (
                    <>
                      <ActionButton
                        label="Dismiss"
                        icon={<X size={12} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />}
                        disabled={busy}
                        onPress={() => resolve(flag, "dismissed")}
                      />
                      {canRemove ? (
                        <ActionButton
                          label="Remove"
                          tone="danger"
                          icon={<Trash2 size={12} color="#CC272E" strokeWidth={1.75} />}
                          disabled={busy}
                          onPress={() => confirmRemove(flag)}
                        />
                      ) : null}
                      <ActionButton
                        label="Resolve"
                        tone="primary"
                        icon={<Check size={12} color="#FAF4E8" strokeWidth={2} />}
                        disabled={busy}
                        onPress={() => resolve(flag, "resolved")}
                      />
                    </>
                  ) : null}
                  {busy ? <ActivityIndicator size="small" /> : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
