// Groups — your joined groups, with a "Browse" toggle for what else is
// visible on the server (and across federation).

import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { Plus } from "lucide-react-native";

import { BackLink } from "../../src/components/ui/BackLink.jsx";
import { GroupCard } from "../../src/components/groups/GroupCard.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { TabletColumns } from "../../src/components/layout/TabletColumns.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useJoinedGroups } from "../../src/lib/useJoinedGroups.js";
import { selectActiveAccount } from "../../src/state/accountsSlice.js";

export default function Groups() {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);

  const { tab: initialTab } = useLocalSearchParams();
  const [tab, setTab] = useState(initialTab === "browse" ? "browse" : "mine"); // "mine" | "browse"

  // My Groups — from user.circles.groups
  const joined = useJoinedGroups();

  // Browse — getGroups (server applies visibility filter)
  const [browseList, setBrowseList] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const [browseRefreshing, setBrowseRefreshing] = useState(false);

  const loadBrowse = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setBrowseRefreshing(true);
      else setBrowseLoading(true);
      setBrowseError(null);
      try {
        const res = await client.feeds.getGroups({ limit: 50 });
        setBrowseList(res?.orderedItems || res?.items || []);
      } catch (e) {
        setBrowseError(e?.message || "Couldn't load groups.");
      } finally {
        setBrowseLoading(false);
        setBrowseRefreshing(false);
      }
    },
    [client]
  );

  useFocusEffect(
    useCallback(() => {
      // Refresh joined groups on focus so a newly created group shows up.
      joined.refresh();
      if (tab === "browse") loadBrowse();
      // joined.refresh is stable enough for this effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, loadBrowse])
  );

  const data = tab === "mine" ? joined.groups : browseList;
  const loading = tab === "mine" ? joined.loading : browseLoading;
  const error = tab === "mine" ? joined.error : browseError;
  const refreshing = tab === "mine" ? false : browseRefreshing;
  const onRefresh =
    tab === "mine"
      ? () => joined.refresh()
      : () => loadBrowse({ isRefresh: true });

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader title="Groups" />

      <TabletColumns>
      <Pressable
        onPress={() => router.push("/group/new")}
        className="flex-row items-center justify-center gap-2 bg-primary py-3.5 mx-4 mt-4 mb-1"
        android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      >
        <Plus size={16} color="#FFFFFF" strokeWidth={2.25} />
        <Text className="font-ui uppercase tracking-[0.18em] text-sm text-primary-content">
          Create Group
        </Text>
      </Pressable>

      {/* Tabs */}
      <View className="flex-row  ">
        <TabButton
          label="My Groups"
          active={tab === "mine"}
          onPress={() => setTab("mine")}
        />
        <TabButton
          label="Browse"
          active={tab === "browse"}
          onPress={() => {
            setTab("browse");
            if (browseList.length === 0) loadBrowse();
          }}
        />
      </View>

      <FlatList
        className="flex-1"
        data={data}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            serverDomain={account?.server}
            baseUrl={account?.baseUrl}
            onPress={() =>
              router.push(`/group/${encodeURIComponent(item.id)}`)
            }
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
                onPress={onRefresh}
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
                {tab === "mine" ? "No groups yet." : "Nothing to browse."}
              </Text>
              <Text className="font-ui text-sm text-base-content/55 text-center leading-6">
                {tab === "mine"
                  ? "Find a group under Browse, or create your own."
                  : "Be the first to start one."}
              </Text>
            </View>
          )
        }
      />
      </TabletColumns>

    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className={`flex-1 py-3 items-center ${
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
