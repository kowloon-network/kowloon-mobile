// User profile — read-only view of a user. Header (avatar, name, handle,
// bio, location) plus three tabs (Posts | Circles | Bookmarks). The server
// gates Circles and Bookmarks to the profile owner — non-owners just see
// empty tabs there, which we render with a discreet "private" empty state.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, MapPin } from "lucide-react-native";

import { Avatar } from "../../../src/components/posts/Avatar.jsx";
import { AppHeader, HeaderButton } from "../../../src/components/nav/AppHeader.jsx";
import { BookmarkComposer } from "../../../src/components/bookmarks/BookmarkComposer.jsx";
import { BookmarkTree } from "../../../src/components/bookmarks/BookmarkTree.jsx";
import {
  BookmarkActionSheet,
  FolderCreateModal,
} from "../../../src/components/bookmarks/BookmarkActionSheet.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { CircleCard } from "../../../src/components/circles/CircleCard.jsx";
import { ProfileActions } from "../../../src/components/profile/ProfileActions.jsx";
import { HtmlContent } from "../../../src/components/HtmlContent.jsx";
import { PostCard } from "../../../src/components/posts/PostCard.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { resolveImageUrl } from "../../../src/lib/resolveImageUrl.js";
import { selectActiveAccount } from "../../../src/state/accountsSlice.js";
import { useInk } from "../../../src/lib/useInk.js";

const TABS = [
  { key: "posts", label: "Posts" },
  { key: "circles", label: "Circles" },
  { key: "bookmarks", label: "Bookmarks" },
];

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
          active ? "text-base-content" : "text-base-content/50"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function UserProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const ink = useInk();

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [circles, setCircles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [tab, setTab] = useState("posts");
  const [linksOpen, setLinksOpen] = useState(false);

  // Bookmarks load lazily on tap; the tree owns its own data.
  const treeRef = useRef(null);
  const [menuTarget, setMenuTarget] = useState(null); // { node, onComplete }
  const [composingBookmark, setComposingBookmark] = useState(false);
  const [composingFolder, setComposingFolder] = useState(false);

  const userId = String(id || "");
  const isSelf = !!account?.id && account.id === userId;

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client || !userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [userRes, postsRes, circlesRes] = await Promise.all([
          client.feeds.getUser({ userId }),
          client.feeds.getUserPosts({ userId }).catch(() => null),
          client.feeds.getUserCircles({ userId }).catch(() => null),
        ]);
        setUser(userRes?.item || userRes?.user || userRes || null);
        setPosts(postsRes?.orderedItems || postsRes?.items || []);
        setCircles(
          (circlesRes?.orderedItems || circlesRes?.items || []).filter(
            (c) => c?.type !== "System"
          )
        );
        // Bookmarks load lazily inside BookmarkTree; pull-to-refresh
        // (below) tells the tree to reload the root level separately.
      } catch (e) {
        setError(e?.message || "Couldn't load this profile.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client, userId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const name = user?.profile?.name || user?.name || user?.username || userId;
  const description = user?.profile?.description;
  const pronouns = user?.profile?.pronouns;
  const location = user?.profile?.location;
  const urls = user?.profile?.urls || [];
  const featuredImage = resolveImageUrl(
    user?.profile?.featuredImage,
    account?.baseUrl
  );
  const me = {
    name,
    icon: user?.profile?.icon || user?.icon,
    id: userId,
  };

  const topHeader = (
    <AppHeader
      back
      title="Profile"
      right={
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {urls.length > 0 ? (
            <Pressable
              onPress={() => setLinksOpen(true)}
              hitSlop={8}
              android_ripple={{ color: "rgba(255,255,255,0.18)", borderless: true }}
              className="  w-9 h-9 items-center justify-center"
            >
              <Link size={16} color="#FFFFFF" strokeWidth={1.9} />
            </Pressable>
          ) : null}
          {isSelf ? (
            <HeaderButton
              label="Edit"
              onPress={() => router.push("/settings/profile")}
            />
          ) : null}
        </View>
      }
    />
  );

  function header() {
    return (
      <View>
        {featuredImage ? (
          <Image
            source={{ uri: featuredImage }}
            style={{ width: "100%", aspectRatio: 3 }}
            className="bg-base-200"
            resizeMode="cover"
          />
        ) : null}
        <View className="px-5 pt-2 pb-5  ">
          <View className="flex-row items-start">
            <Avatar actor={me} size={72} baseUrl={account?.baseUrl} />
            <View className="flex-1 ml-4 min-w-0">
              <Text
                className="font-ui text-2xl text-base-content leading-tight"
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                className="font-ui text-xs text-base-content/55 mt-0.5"
                numberOfLines={1}
              >
                {userId}
              </Text>
              {pronouns ? (
                <Text
                  className="font-ui text-xs text-base-content/45 mt-0.5"
                  numberOfLines={1}
                >
                  {pronouns}
                </Text>
              ) : null}
              {location?.name ? (
                <View className="flex-row items-center mt-2">
                  <MapPin
                    size={11}
                    color={ink(0.55)}
                    strokeWidth={1.75}
                  />
                  <Text
                    className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/55 ml-1.5 flex-1"
                    numberOfLines={1}
                  >
                    {location.name}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {description ? (
            <View className="mt-4">
              <HtmlContent html={description} fontSize={15} />
            </View>
          ) : null}
        </View>

        {/* Relationship actions — only on someone else's profile. */}
        {!isSelf ? (
          <ProfileActions
            client={client}
            account={account}
            targetId={userId}
            name={name}
          />
        ) : null}

        {/* Tabs */}
        <View className="flex-row  ">
          {TABS.map((t) => (
            <TabButton
              key={t.key}
              label={t.label}
              active={tab === t.key}
              onPress={() => setTab(t.key)}
            />
          ))}
        </View>
      </View>
    );
  }

  // Pick the data + renderer + key for the flat-list tabs (posts, circles).
  // Bookmarks goes through a separate ScrollView path below so the tree can
  // own its own lazy-loaded state.
  const view = (() => {
    if (tab === "posts") {
      return {
        data: posts,
        keyExtractor: (p) => p.id,
        renderItem: ({ item }) => <PostCard post={item} />,
        emptyTitle: "No posts yet.",
        emptyBody: isSelf
          ? "Anything you post lands here."
          : "When this person posts something, you'll see it here.",
      };
    }
    return {
      data: circles,
      keyExtractor: (c) => c.id,
      renderItem: ({ item }) => (
        <CircleCard
          circle={item}
          serverDomain={account?.server}
          baseUrl={account?.baseUrl}
          onPress={() =>
            router.push(`/circle/${encodeURIComponent(item.id)}`)
          }
        />
      ),
      emptyTitle: isSelf ? "No circles yet." : "Private.",
      emptyBody: isSelf
        ? "Circles you create show up here."
        : "Someone's circles are visible only to themselves.",
    };
  })();

  function refreshActive() {
    load({ isRefresh: true });
    if (tab === "bookmarks") treeRef.current?.refreshRoot?.();
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
        {topHeader}
        {header()}
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
        {topHeader}
        {header()}
        <View className="py-20 items-center px-6">
          <Text className="font-ui text-base text-error text-center mb-4">
            {error}
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      {topHeader}
      {tab === "bookmarks" ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshActive} />
          }
        >
          {header()}
          {isSelf ? (
            <View className="flex-row items-center px-5 py-2   bg-base-200">
              <Pressable
                onPress={() => setComposingBookmark(true)}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="px-3 py-1.5   mr-2 bg-base-100"
              >
                <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/70">
                  + Bookmark
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setComposingFolder(true)}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="px-3 py-1.5   bg-base-100"
              >
                <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/70">
                  + Folder
                </Text>
              </Pressable>
            </View>
          ) : null}
          <BookmarkTree
            ref={treeRef}
            userId={userId}
            client={client}
            isOwner={isSelf}
            account={account}
            onMenu={setMenuTarget}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={view.data}
          keyExtractor={view.keyExtractor}
          renderItem={view.renderItem}
          ListHeaderComponent={header()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshActive} />
          }
          ListEmptyComponent={
            <View className="px-6 py-16 items-center">
              <Text className="font-ui text-lg text-base-content/70 text-center mb-2">
                {view.emptyTitle}
              </Text>
              <Text className="font-ui text-sm text-base-content/55 text-center leading-6">
                {view.emptyBody}
              </Text>
            </View>
          }
        />
      )}

      <BookmarkActionSheet
        target={menuTarget}
        client={client}
        account={account}
        onClose={() => setMenuTarget(null)}
        onMutated={() => {
          menuTarget?.onComplete?.();
          treeRef.current?.refreshRoot?.();
          setMenuTarget(null);
        }}
      />

      {isSelf ? (
        <>
          <BookmarkComposer
            visible={composingBookmark}
            onClose={() => setComposingBookmark(false)}
            initialValues={{}}
            client={client}
            currentUser={user}
            onSaved={() => {
              treeRef.current?.refreshRoot?.();
              setComposingBookmark(false);
            }}
          />
          <FolderCreateModal
            visible={composingFolder}
            client={client}
            onClose={() => setComposingFolder(false)}
            onCreated={() => {
              treeRef.current?.refreshRoot?.();
              setComposingFolder(false);
            }}
          />
        </>
      ) : null}

      {/* Profile links — bottom sheet of the user's URLs. */}
      <Modal
        visible={linksOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLinksOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setLinksOpen(false)}
        >
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={["bottom"]} className="bg-base-100">
              <View className=" ">
                <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 px-5 pt-4 pb-2">
                  Links
                </Text>
                {urls.map((url) => (
                  <Pressable
                    key={url}
                    onPress={() => {
                      setLinksOpen(false);
                      Linking.openURL(url).catch(() => {});
                    }}
                    android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                    className="flex-row items-center px-5 py-3  "
                  >
                    <Link size={16} color="#5588B1" strokeWidth={1.9} />
                    <Text
                      className="flex-1 font-ui text-sm text-base-content ml-3"
                      numberOfLines={1}
                    >
                      {url}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
