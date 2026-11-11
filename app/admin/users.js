// Admin users -- paginated user list with per-user actions: deactivate,
// restore, promote to admin / moderator, and ban (permanent deletion via the
// server Blocked list). Tap a user for the action sheet.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { AppHeader, HeaderButton } from "../../src/components/nav/AppHeader.jsx";
import { Avatar } from "../../src/components/posts/Avatar.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { selectActiveAccount } from "../../src/state/accountsSlice.js";
import { useInk } from "../../src/lib/useInk.js";
import { banMessage } from "../../src/components/admin/blocklistUtils.js";

const TABS = [
  { key: "active", label: "Active" },
  { key: "all", label: "All" },
];

function isDeactivated(u) {
  return u?.active === false || !!u?.deletedAt;
}

function ActionRow({ label, onPress, destructive }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      className="px-5 py-3.5 border-b border-base-200"
    >
      <Text
        className={`font-ui text-base ${destructive ? "text-error" : "text-base-content"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function AdminUsers() {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const ink = useInk();

  const [tab, setTab] = useState("active");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // the user whose action sheet is open
  const [busy, setBusy] = useState(false);
  const [banning, setBanning] = useState(false); // sheet is showing the ban reason form
  const [banReason, setBanReason] = useState("");

  const fetchPage = useCallback(
    async (p, showDeleted) => {
      const res = await client.admin.getUsers({ page: p, showDeleted });
      const list = res?.orderedItems || res?.items || [];
      const { totalItems = 0, itemsPerPage = list.length || 20 } = res || {};
      const fetchedPage = res?.page ?? p;
      return { list, hasMore: fetchedPage * itemsPerPage < totalItems };
    },
    [client]
  );

  const load = useCallback(
    async (nextTab, { isRefresh = false } = {}) => {
      if (!client) return;
      const t = nextTab ?? tab;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const { list, hasMore: more } = await fetchPage(1, t === "all");
        setItems(list);
        setPage(1);
        setHasMore(more);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load users."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client, tab, fetchPage]
  );

  useEffect(() => {
    load(tab);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const { list, hasMore: more } = await fetchPage(next, tab === "all");
      setItems((arr) => [...arr, ...list]);
      setPage(next);
      setHasMore(more);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  }

  function patchUser(id, patch) {
    setItems((arr) => arr.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function runAction(fn, successPatch) {
    if (busy) return;
    const u = sheet;
    setBusy(true);
    try {
      await fn(u);
      if (successPatch) patchUser(u.id, successPatch);
      setSheet(null);
    } catch (e) {
      Alert.alert("Couldn't complete", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onDeactivate() {
    const u = sheet;
    Alert.alert(
      "Deactivate user?",
      `${u.profile?.name || u.id} will be signed out and hidden. You can restore them later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: () =>
            runAction(
              (usr) => client.admin.deleteUser({ userId: usr.id }),
              { active: false, deletedAt: new Date().toISOString() }
            ),
        },
      ]
    );
  }

  function closeSheet() {
    setSheet(null);
    setBanning(false);
    setBanReason("");
  }

  function onBan() {
    const u = sheet;
    const name = displayName(u);
    Alert.alert(`Ban ${name}?`, banMessage(name), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Ban",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await client.admin.addToBlocklist({
              list: "blocked",
              target: u.id,
              summary: banReason.trim() || undefined,
              confirmBan: true,
            });
            setItems((arr) => arr.filter((x) => x.id !== u.id));
            closeSheet();
            Alert.alert("Banned", `${name}'s account and posts are deleted.`);
          } catch (e) {
            Alert.alert("Couldn't ban", e?.message || "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  const displayName = (u) => u?.profile?.name || u?.username || u?.id;

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title="Users"
        right={<HeaderButton label="New" onPress={() => router.push("/admin/user/new")} />}
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
          <Text className="font-ui text-base text-base-content/60 text-center py-20">
            No users found.
          </Text>
        ) : (
          <>
            {items.map((u) => {
              const off = isDeactivated(u);
              return (
                <Pressable
                  key={u.id}
                  onPress={() => setSheet(u)}
                  android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                  className="flex-row items-center px-5 py-3 border-b border-base-200"
                >
                  <Avatar
                    actor={{ name: displayName(u), icon: u.profile?.icon }}
                    size={40}
                    baseUrl={account?.baseUrl}
                  />
                  <View className="flex-1 ml-3 min-w-0">
                    <Text className="font-ui text-sm font-bold text-base-content" numberOfLines={1}>
                      {displayName(u)}
                    </Text>
                    <Text className="font-ui text-xs text-base-content/55" numberOfLines={1}>
                      {u.id}
                    </Text>
                  </View>
                  {off ? (
                    <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-error bg-error/10 px-2 py-0.5 ml-2">
                      Deactivated
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

            {hasMore ? (
              <Pressable
                onPress={loadMore}
                disabled={loadingMore}
                className="py-4 items-center"
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content/50">
                    Load more
                  </Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Per-user action sheet */}
      <Modal
        visible={!!sheet}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => (busy ? null : closeSheet())}>
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={["bottom"]} className="bg-base-100">
              <View className="flex-row items-center px-5 py-3 bg-secondary">
                <Text className="font-ui text-lg text-secondary-content flex-1" numberOfLines={1}>
                  {sheet ? displayName(sheet) : ""}
                </Text>
                <Pressable onPress={closeSheet} hitSlop={8} disabled={busy}>
                  <X size={18} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
                </Pressable>
              </View>

              {busy ? (
                <View className="py-6 items-center">
                  <ActivityIndicator />
                </View>
              ) : sheet && banning ? (
                <View className="px-5 py-4">
                  <Text className="font-ui text-sm text-base-content/70 leading-5 mb-3">
                    Banning permanently deletes this account and everything they posted. Their
                    username stays reserved and their email can't sign up again.
                  </Text>
                  <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
                    Reason (optional)
                  </Text>
                  <TextInput
                    value={banReason}
                    onChangeText={setBanReason}
                    placeholder="Why they're being banned"
                    placeholderTextColor={ink(0.35)}
                    className="bg-field border border-base-300 px-3 py-2.5 font-ui text-base text-base-content mb-3"
                  />
                  <View className="flex-row" style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        setBanning(false);
                        setBanReason("");
                      }}
                      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                      className="flex-1 items-center py-3 border-2 border-base-300"
                    >
                      <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content">
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={onBan}
                      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                      className="flex-1 items-center py-3 bg-error"
                    >
                      <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-error-content">
                        Ban
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : sheet ? (
                <>
                  <ActionRow
                    label="View profile"
                    onPress={() => {
                      const id = sheet.id;
                      closeSheet();
                      router.push(`/user/${encodeURIComponent(id)}`);
                    }}
                  />
                  <ActionRow
                    label="Make admin"
                    onPress={() =>
                      runAction((u) => client.admin.addAdmin({ userId: u.id }))
                    }
                  />
                  <ActionRow
                    label="Make moderator"
                    onPress={() =>
                      runAction((u) => client.admin.addMod({ userId: u.id }))
                    }
                  />
                  {isDeactivated(sheet) ? (
                    <ActionRow
                      label="Restore user"
                      onPress={() =>
                        runAction(
                          (u) => client.admin.restoreUser({ userId: u.id }),
                          { active: true, deletedAt: null }
                        )
                      }
                    />
                  ) : (
                    <ActionRow label="Deactivate user" destructive onPress={onDeactivate} />
                  )}
                  {sheet.id !== account?.id ? (
                    <ActionRow label="Ban user" destructive onPress={() => setBanning(true)} />
                  ) : null}
                </>
              ) : null}
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
