// Circles — Kowloon's social-graph primitive.
//
// "My Circles" lists the circles owned by the active account. "Browse" shows
// public + server-local circles anyone can discover, copy, or read. Tap a
// circle to view/manage it; the header "+ New" creates one. Circles are how
// Kowloon replaces follow/unfollow — curated lists of people whose posts you
// read.

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
import { sortByPins } from "@kowloon/client";

import { CircleCard } from "../../src/components/circles/CircleCard.jsx";
import { AppHeader, HeaderButton } from "../../src/components/nav/AppHeader.jsx";
import { TabletColumns } from "../../src/components/layout/TabletColumns.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { selectActiveAccount } from "../../src/state/accountsSlice.js";

export default function Circles() {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);

  const { tab: initialTab } = useLocalSearchParams();
  const [tab, setTab] = useState(initialTab === "browse" ? "browse" : "mine"); // "mine" | "browse"

  // My Circles — the account's own circles (owner-scoped).
  const [mine, setMine] = useState([]);
  const [mineLoading, setMineLoading] = useState(true);
  const [mineError, setMineError] = useState(null);
  const [mineRefreshing, setMineRefreshing] = useState(false);

  // Browse — local discovery (public + server), minus the ones you already own.
  const [browseList, setBrowseList] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const [browseRefreshing, setBrowseRefreshing] = useState(false);

  const loadMine = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client || !account?.id) return;
      if (isRefresh) setMineRefreshing(true);
      else setMineLoading(true);
      setMineError(null);
      try {
        const res = await client.feeds.getUserCircles({ userId: account.id });
        const items = res?.orderedItems || res?.items || [];
        // Hide system circles (Following, Groups, Blocked, Muted) — those are
        // managed implicitly, not curated by hand. Order by the user's pins so
        // this matches the feed selector and everywhere else circles are listed.
        const pinned = client?.auth?.getUser?.()?.prefs?.pinnedCircles || [];
        setMine(sortByPins(items.filter((c) => c?.type !== "System"), pinned));
      } catch (e) {
        setMineError(e?.message || "Couldn't load your circles.");
      } finally {
        setMineLoading(false);
        setMineRefreshing(false);
      }
    },
    [client, account?.id]
  );

  const loadBrowse = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setBrowseRefreshing(true);
      else setBrowseLoading(true);
      setBrowseError(null);
      try {
        const res = await client.feeds.getCircles({ sort: "reacts", limit: 50 });
        const items = res?.orderedItems || res?.items || [];
        // Skip system circles and the ones you already own — Browse is for
        // discovering other people's circles.
        setBrowseList(
          items.filter(
            (c) =>
              c?.type !== "System" &&
              (c?.actorId || c?.actor?.id) !== account?.id
          )
        );
      } catch (e) {
        setBrowseError(e?.message || "Couldn't load circles.");
      } finally {
        setBrowseLoading(false);
        setBrowseRefreshing(false);
      }
    },
    [client, account?.id]
  );

  useFocusEffect(
    useCallback(() => {
      loadMine();
      if (tab === "browse") loadBrowse();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, loadMine, loadBrowse])
  );

  const data = tab === "mine" ? mine : browseList;
  const loading = tab === "mine" ? mineLoading : browseLoading;
  const error = tab === "mine" ? mineError : browseError;
  const refreshing = tab === "mine" ? mineRefreshing : browseRefreshing;
  const onRefresh =
    tab === "mine"
      ? () => loadMine({ isRefresh: true })
      : () => loadBrowse({ isRefresh: true });

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        title="Circles"
        right={
          <HeaderButton
            label="New"
            icon={<Plus size={14} color="#FFFFFF" strokeWidth={2} />}
            onPress={() => router.push("/circle/new")}
          />
        }
      />

      <TabletColumns>
      {/* Tabs */}
      <View className="flex-row  ">
        <TabButton
          label="My Circles"
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
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CircleCard
            circle={item}
            serverDomain={account?.server}
            baseUrl={account?.baseUrl}
            onPress={() =>
              router.push(`/circle/${encodeURIComponent(item.id)}`)
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
                {tab === "mine" ? "No circles yet." : "Nothing to browse."}
              </Text>
              <Text className="font-ui text-sm text-base-content/55 text-center leading-6">
                {tab === "mine"
                  ? "Circles are curated lists of people whose posts you want to read. Create one, or find one under Browse to copy."
                  : "No public circles to discover yet. Create your own."}
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
