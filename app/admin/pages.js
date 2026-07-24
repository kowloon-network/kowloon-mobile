// Admin pages — list server content pages. Active tab opens the editor; Deleted
// tab offers restore. New page via the header button.

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
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
import { ChevronRight, FileText, Folder } from "lucide-react-native";

import { AppHeader, HeaderButton } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";

const TABS = [
  { key: "active", label: "Active" },
  { key: "deleted", label: "Deleted" },
];

export default function AdminPages() {
  const router = useRouter();
  const client = useActiveClient();

  const [tab, setTab] = useState("active");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (nextTab, { isRefresh = false } = {}) => {
      if (!client) return;
      const t = nextTab ?? tab;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.admin.getPages({ showDeleted: t === "deleted" });
        setItems(res?.orderedItems || res?.items || []);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load pages."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client, tab]
  );

  useEffect(() => {
    load(tab);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh when returning from the editor.
  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function restore(page) {
    if (busyId) return;
    setBusyId(page.id);
    try {
      await client.admin.restorePage({ pageId: page.id });
      setItems((arr) => arr.filter((p) => p.id !== page.id));
    } catch (e) {
      Alert.alert("Couldn't restore", e?.message || "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const isDeleted = tab === "deleted";

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title="Pages"
        right={<HeaderButton label="New" onPress={() => router.push("/admin/page/new")} />}
      />

      <View className="flex-row border-b border-base-200">
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              className={`flex-1 items-center py-3 ${active ? "border-b-2 border-primary" : ""}`}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            >
              <Text
                className={`font-ui uppercase tracking-[0.14em] text-[11px] ${
                  active ? "text-base-content" : "text-base-content/45"
                }`}
              >
                {tb.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(tab, { isRefresh: true })} />
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
              {isDeleted ? "No deleted pages." : "No pages yet."}
            </Text>
            {!isDeleted ? (
              <Text className="font-ui text-sm text-base-content/45 text-center leading-6">
                Tap New to create your first page.
              </Text>
            ) : null}
          </View>
        ) : (
          items.map((page) => {
            const isFolder = page.type === "Folder";
            return (
              <Pressable
                key={page.id}
                onPress={() =>
                  isDeleted
                    ? null
                    : router.push(`/admin/page/${encodeURIComponent(page.id)}`)
                }
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className="flex-row items-center px-5 py-3.5 border-b border-base-200"
              >
                <View className="mr-3">
                  {isFolder ? (
                    <Folder size={18} color="rgba(26,26,32,0.6)" strokeWidth={1.75} />
                  ) : (
                    <FileText size={18} color="rgba(26,26,32,0.6)" strokeWidth={1.75} />
                  )}
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="font-ui text-base text-base-content" numberOfLines={1}>
                    {page.title || "Untitled"}
                  </Text>
                  <Text className="font-ui text-xs text-base-content/50" numberOfLines={1}>
                    {page.slug ? `/${page.slug}` : page.id}
                    {page.to && page.to !== "@public" ? " · server" : ""}
                  </Text>
                </View>
                {isDeleted ? (
                  <Pressable
                    onPress={() => restore(page)}
                    disabled={busyId === page.id}
                    className="px-3 py-1.5 bg-base-200"
                    android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  >
                    {busyId === page.id ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content">
                        Restore
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <ChevronRight size={18} color="rgba(26,26,32,0.35)" strokeWidth={1.75} />
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
