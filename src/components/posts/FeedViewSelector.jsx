// FeedViewSelector — pick what you're reading.
//
// Choices: All Posts (merged public + server), one of the user's circles, or a
// joined group. The trigger is the current view's title; tapping opens a
// dropdown anchored directly below the trigger (not a bottom sheet).
//
// Returns the active feed view key:
//   "all"          — getServerPosts()  (merged public + server firehose)
//   "circle:<id>"  — getCirclePosts({ circleId })
//   "group:<id>"   — getGroupPosts({ groupId })   (joined groups)

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Compass, Pin } from "lucide-react-native";
import { sortByPins, togglePin } from "@kowloon/client";

import { useActiveClient } from "../../lib/useActiveClient.js";
import { useJoinedGroups } from "../../lib/useJoinedGroups.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";
import { orderUserCircles } from "../../lib/orderCircles.js";
import { ServerFeedIcon } from "./ServerFeedIcon.jsx";
import { HexAvatar } from "../ui/HexAvatar.jsx";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";

const DROPDOWN_WIDTH = 240;

export function FeedViewSelector({ value, onChange, subject }) {
  // `subject` (from useFeedSubject, via FeedHeader) is the resolved circle/group
  // behind `value` when it isn't one of your own — used so the trigger shows
  // its real name/icon instead of falling back to "Public".
  const subjectForValue = subject?.id === value ? subject : null;
  // Any key that isn't a circle/group is the merged "All Posts" view (covers
  // "all" plus legacy "public"/"server"/"" persisted values).
  const isSubjectView =
    typeof value === "string" &&
    (value.startsWith("circle:") || value.startsWith("group:"));
  const isMineView = value === "mine";
  const account = useSelector(selectActiveAccount);
  const client = useActiveClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [circles, setCircles] = useState([]);
  const [search, setSearch] = useState("");
  const { groups, refresh: refreshGroups } = useJoinedGroups();
  const baseUrl = client?.http?.baseUrl;
  const [serverIcon, setServerIcon] = useState(null);
  // Feed-selector pins (Kowloon IDs) from the account's server prefs. Loaded
  // from the client's auth user; toggled optimistically, then persisted.
  const [pinnedCircles, setPinnedCircles] = useState([]);
  const [pinnedGroups, setPinnedGroups] = useState([]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      let user = client.auth?.getUser?.();
      if (!user) {
        try { user = await client.init(); } catch { user = null; }
      }
      if (cancelled) return;
      setPinnedCircles(user?.prefs?.pinnedCircles || []);
      setPinnedGroups(user?.prefs?.pinnedGroups || []);
    })();
    return () => { cancelled = true; };
  }, [client, account?.id]);

  function handleTogglePin(kind, id) {
    if (kind === "circle") {
      const prev = pinnedCircles;
      const next = togglePin(prev, id);
      setPinnedCircles(next);
      client?.activities?.setPins?.({ circles: next }).catch(() => setPinnedCircles(prev));
    } else {
      const prev = pinnedGroups;
      const next = togglePin(prev, id);
      setPinnedGroups(next);
      client?.activities?.setPins?.({ groups: next }).catch(() => setPinnedGroups(prev));
    }
  }

  const serverViews = useMemo(
    () => [
      {
        value: "all",
        label: "Community Posts",
        summary: `All public and community posts from ${
          account?.serverName || account?.server || "this server"
        }.`,
      },
    ],
    [account?.serverName, account?.server]
  );

  useEffect(() => {
    if (!client || !account?.id) return;
    let cancelled = false;
    client.feeds
      .getUserCircles({ userId: account.id })
      .then((res) => {
        const items = res?.orderedItems || res?.items || [];
        if (!cancelled) {
          setCircles(orderUserCircles(items, account?.id));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, account?.id]);

  // Server icon for the Public/Server overlay glyphs.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds
      .getServerInfo()
      .then((info) => {
        if (!cancelled && info?.icon) {
          setServerIcon(resolveImageUrl(info.icon, baseUrl));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, baseUrl]);

  // Icon for the collapsed trigger: server overlay for Public/Server, the
  // circle's / group's hex avatar otherwise.
  function iconFor(value, size = 20) {
    if (value === "mine") {
      return (
        <HexAvatar
          uri={resolveImageUrl(account?.profile?.icon, baseUrl)}
          size={size}
        />
      );
    }
    const circle = circles.find((c) => c.id === value);
    if (circle) {
      return <HexAvatar uri={resolveImageUrl(circle.icon, baseUrl)} size={size} />;
    }
    const group = groups.find((g) => g.id === value);
    if (group) {
      return <HexAvatar uri={resolveImageUrl(group.icon, baseUrl)} size={size} />;
    }
    // Not one of your own — fall back to the resolved subject's hex avatar.
    if (subjectForValue) {
      return (
        <HexAvatar uri={resolveImageUrl(subjectForValue.icon, baseUrl)} size={size} />
      );
    }
    // "All Posts" — the server icon under a globe (the whole network mix).
    return <ServerFeedIcon iconUrl={serverIcon} variant="public" size={size} />;
  }

  const currentLabel =
    (isMineView && "My Posts") ||
    circles.find((c) => c.id === value)?.name ||
    groups.find((g) => g.id === value)?.name ||
    subjectForValue?.name ||
    "Community Posts";

  function openDropdown() {
    // Refetch circles AND groups on every open so newly added circles / joined
    // groups appear immediately (and a mount-time load that raced auth is retried).
    if (client && account?.id) {
      client.feeds
        .getUserCircles({ userId: account.id })
        .then((res) => {
          const items = res?.orderedItems || res?.items || [];
          setCircles(orderUserCircles(items, account?.id));
        })
        .catch(() => {});
    }
    refreshGroups?.();
    triggerRef.current?.measureInWindow((x, y, _w, h) => {
      setDropPos({ top: y + h, left: x });
      setOpen(true);
    });
  }

  function close() {
    setOpen(false);
    setSearch("");
  }

  function select(v) {
    onChange(v);
    close();
  }

  // One search box filters BOTH circles and groups. Only worth showing once the
  // combined list is long enough to bother scanning.
  const q = search.trim().toLowerCase();
  // Show the search box whenever there's anything to search (was >5, which hid
  // it for anyone with a handful of circles/groups).
  const showSearch = circles.length + groups.length > 0;
  const filteredCircles = sortByPins(
    q ? circles.filter((c) => c.name?.toLowerCase().includes(q)) : circles,
    pinnedCircles
  );
  const filteredGroups = sortByPins(
    q ? groups.filter((g) => g.name?.toLowerCase().includes(q)) : groups,
    pinnedGroups
  );
  const noMatches =
    q && filteredCircles.length === 0 && filteredGroups.length === 0;

  // Height available to the dropdown: from its top down to just above the
  // Android nav bar / bottom safe-area inset (window height includes that area,
  // so without subtracting it the footer gets clipped by the nav buttons).
  const screenH = Dimensions.get("window").height;
  const availableHeight = Math.max(
    280,
    screenH - dropPos.top - insets.bottom - 12
  );
  // Split the space left below the fixed rows between the two sections so a long
  // list in one never buries the other. ~300 covers the fixed rows + footer.
  const sectionMax = Math.max(
    120,
    Math.floor((availableHeight - 300) / 2)
  );

  function goDiscover() {
    close();
    router.push("/discover");
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openDropdown}
        hitSlop={6}
        className="flex-row items-center shrink min-w-0"
      >
        <View className="mr-2.5">{iconFor(value, 26)}</View>
        {/* shrink + numberOfLines so a long circle/group name truncates instead
            of expanding the trigger and overlapping the type filters (#68). */}
        <Text
          className="font-ui text-base font-bold tracking-tight text-base-content mr-1.5 shrink min-w-0"
          numberOfLines={1}
        >
          {currentLabel}
        </Text>
        <Text className="font-ui text-sm text-base-content/50">▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
      >
        {/* Full-screen dismiss backdrop */}
        <Pressable className="flex-1" onPress={close}>
          {/* Stop propagation so tapping inside the dropdown doesn't close it */}
          <Pressable
            onPress={() => {}}
            style={{
              position: "absolute",
              top: dropPos.top,
              left: dropPos.left,
              width: DROPDOWN_WIDTH,
              // Never extend past the bottom nav bar (clips the Discover footer).
              maxHeight: availableHeight,
              // Subtle border + light shadow so the dropdown reads as a floating
              // panel over content (the borderless white was blending in).
              elevation: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
            }}
            className="bg-base-100 border border-base-300"
          >
            {/* Unified search — filters circles + groups together */}
            {showSearch ? (
              <View className="px-3 py-2 border-b border-base-200">
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search circles & groups..."
                  placeholderTextColor="rgba(26,26,32,0.3)"
                  autoCorrect={false}
                  autoCapitalize="none"
                  className="font-ui text-sm text-base-content"
                  style={{ paddingVertical: 3 }}
                />
              </View>
            ) : null}

            {/* Community + My Posts stay fixed at the top */}
            {serverViews.map((v) => (
              <Row
                key={v.value}
                label={v.label}
                summary={v.summary}
                selected={!isSubjectView && !isMineView}
                onPress={() => select(v.value)}
                icon={
                  <ServerFeedIcon iconUrl={serverIcon} variant="public" size={22} />
                }
              />
            ))}
            <Row
              key="mine"
              label="My Posts"
              summary="Everything you've posted, to any audience."
              selected={isMineView}
              onPress={() => select("mine")}
              icon={
                <HexAvatar
                  uri={resolveImageUrl(account?.profile?.icon, baseUrl)}
                  size={22}
                />
              }
            />

            {/* Your circles — own scroll area, capped so it never buries groups */}
            {filteredCircles.length > 0 ? (
              <View className="mt-1">
                <Text className="font-ui uppercase tracking-[0.18em] text-[10px] text-base-content/40 px-4 pt-3 pb-1">
                  Your circles
                </Text>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  bounces={false}
                  style={{ maxHeight: sectionMax }}
                >
                  {filteredCircles.map((c) => (
                    <Row
                      key={c.id}
                      label={c.name}
                      summary={c.summary}
                      selected={value === c.id}
                      onPress={() => select(c.id)}
                      pinned={pinnedCircles.includes(c.id)}
                      onTogglePin={() => handleTogglePin("circle", c.id)}
                      icon={
                        <HexAvatar uri={resolveImageUrl(c.icon, baseUrl)} size={22} />
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Your groups — its own scroll area, always visible below circles */}
            {filteredGroups.length > 0 ? (
              <View className="mt-1">
                <Text className="font-ui uppercase tracking-[0.18em] text-[10px] text-base-content/40 px-4 pt-3 pb-1">
                  Your groups
                </Text>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  bounces={false}
                  style={{ maxHeight: sectionMax }}
                >
                  {filteredGroups.map((g) => (
                    <Row
                      key={g.id}
                      label={g.name}
                      selected={value === g.id}
                      onPress={() => select(g.id)}
                      pinned={pinnedGroups.includes(g.id)}
                      onTogglePin={() => handleTogglePin("group", g.id)}
                      icon={
                        <HexAvatar uri={resolveImageUrl(g.icon, baseUrl)} size={22} />
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {noMatches ? (
              <Text className="font-ui text-xs text-base-content/40 px-4 py-3">
                No circles or groups match.
              </Text>
            ) : null}

            {/* Discover footer — pinned below the scroll, always reachable */}
            <Pressable
              onPress={goDiscover}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              className="flex-row items-center px-4 py-3  "
            >
              <View className="mr-3">
                <Compass size={20} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />
              </View>
              <Text className="font-ui uppercase tracking-[0.14em] text-xs text-base-content">
                Discover...
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ label, summary, selected, onPress, icon, pinned, onTogglePin }) {
  return (
    <View className={`flex-row items-center ${selected ? "bg-secondary" : ""}`}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
        className="flex-row items-center flex-1 min-w-0 px-4 py-3"
      >
        {icon ? <View className="mr-3">{icon}</View> : null}
        <View className="flex-1 min-w-0">
          <Text
            className={`font-ui uppercase tracking-[0.14em] text-xs ${
              selected ? "text-secondary-content" : "text-base-content"
            }`}
          >
            {label}
          </Text>
          {summary ? (
            <Text
              className={`font-ui text-xs mt-0.5 ${
                selected ? "text-secondary-content/70" : "text-base-content/45"
              }`}
              numberOfLines={1}
            >
              {summary}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {onTogglePin ? (
        <Pressable
          onPress={onTogglePin}
          hitSlop={8}
          android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: true }}
          className="px-4 py-3"
          accessibilityLabel={pinned ? "Unpin" : "Pin to top"}
        >
          <Pin
            size={15}
            color={pinned ? "#5588B1" : "rgba(26,26,32,0.28)"}
            fill={pinned ? "#5588B1" : "none"}
            strokeWidth={1.75}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
