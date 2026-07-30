// Discover — the server's curated shelves plus people search, over a blurred,
// darkened version of the server hero image (the `discoverBackground` setting,
// generated server-side; Klein-blue fallback when a server has no hero).
// Featured content sits in translucent black panels with white text.
//
// Shelves come from GET /recommendations (server-curated sections of Posts,
// Circles, Groups, Bookmarks). The search box finds people to add to circles.

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "../../src/components/posts/Avatar.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { RecShelf } from "../../src/components/discover/RecShelf.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { resolveImageUrl } from "../../src/lib/resolveImageUrl.js";
import { rootStorage } from "../../src/lib/storage.js";

const BANNER_KEY = "kowloon_discover_welcomed";
const KLEIN = "#002FA7";

function UserRow({ user, router }) {
  const actor = {
    name: user.profile?.name || user.username,
    icon: user.profile?.icon,
  };
  return (
    <Pressable
      className="flex-row items-center py-3 gap-3"
      onPress={() => router.push(`/user/${encodeURIComponent(user.id)}`)}
      android_ripple={{ color: "rgba(255,255,255,0.08)" }}
    >
      <Avatar actor={actor} size={36} baseUrl={user.baseUrl} />
      <View className="flex-1 min-w-0">
        <Text className="font-ui text-sm font-semibold text-white" numberOfLines={1}>
          {actor.name}
        </Text>
        <Text className="font-ui text-xs text-white/55" numberOfLines={1}>
          {user.id}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Discover() {
  const client = useActiveClient();
  const router = useRouter();
  const baseUrl = client?.http?.baseUrl;

  const [banner, setBanner] = useState(false);
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState(null);

  const debounceRef = useRef(null);

  useEffect(() => {
    rootStorage.getItem(BANNER_KEY).then((val) => {
      if (val === "1") setBanner(true);
    });
  }, []);

  // Server hero -> blurred/darkened Discover background.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds
      .getServerInfo()
      .then((info) => {
        if (cancelled) return;
        const bg = info?.settings?.discoverBackground || info?.discoverBackground;
        if (bg) setBgUrl(resolveImageUrl(bg, baseUrl));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, baseUrl]);

  function dismissBanner() {
    setBanner(false);
    rootStorage.setItem(BANNER_KEY, "0");
  }

  useFocusEffect(
    useCallback(() => {
      if (!client) return;
      setLoading(true);
      setError(null);
      client.feeds
        .getRecommendations()
        .then((res) => setSections(res?.sections ?? []))
        .catch((e) => setError(e?.message || "Couldn't load Discover."))
        .finally(() => setLoading(false));
    }, [client])
  );

  // Debounced people search.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (!client) return;
      setUsersLoading(true);
      try {
        const res = await client.search.searchUsers({ query: q, limit: 10 });
        setUsers(res?.orderedItems ?? res?.items ?? []);
      } catch {
        setUsers([]);
      }
      setUsersLoading(false);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, client]);

  const searching = query.trim().length >= 2;

  return (
    <View className="flex-1" style={{ backgroundColor: KLEIN }}>
      {/* Blurred, darkened hero background (baked server-side). */}
      {bgUrl ? (
        <Image source={{ uri: bgUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      <SafeAreaView
        className="flex-1"
        edges={["left", "right"]}
        style={{ backgroundColor: "transparent" }}
      >
        <AppHeader title="Discover" />
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {banner ? (
            <View className="mx-4 mt-4 bg-black/50 px-5 py-5">
              <Text className="font-display text-2xl text-white mb-1">
                Welcome to Kowloon.
              </Text>
              <Text className="font-ui text-sm text-white/80 leading-relaxed mb-3">
                Explore what the server recommends below, or search for people to
                add to your circles.
              </Text>
              <Pressable onPress={dismissBanner} hitSlop={12}>
                <Text className="font-ui text-xs uppercase tracking-widest text-white/60">
                  Got it — dismiss
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* People search */}
          <View className="px-4 pt-4">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search for people..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              className="bg-black/30 px-3 h-11 font-ui text-sm text-white"
            />
          </View>

          {searching ? (
            <View className="mx-4 mt-4 bg-black/50 px-4 py-3">
              <Text className="font-ui text-[10px] uppercase tracking-widest text-white/50 mb-2">
                People
              </Text>
              {usersLoading ? (
                <ActivityIndicator className="py-4" color="#fff" />
              ) : users.length > 0 ? (
                users.map((u) => <UserRow key={u.id} user={u} router={router} />)
              ) : (
                <Text className="font-ui text-sm text-white/50 py-3">
                  No people found for "{query.trim()}".
                </Text>
              )}
            </View>
          ) : (
            <View className="pt-5">
              {loading ? (
                <View className="py-16 items-center">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : error ? (
                <View className="mx-4 bg-black/50 px-6 py-16 items-center">
                  <Text className="font-ui text-sm text-white text-center">{error}</Text>
                </View>
              ) : sections.length === 0 ? (
                <View className="mx-4 bg-black/50 px-6 py-16 items-center">
                  <Text className="font-ui text-base text-white text-center mb-1">
                    Nothing recommended yet.
                  </Text>
                  <Text className="font-ui text-sm text-white/60 text-center leading-6">
                    When the server curates Circles, Groups, and posts worth your
                    time, they'll appear here.
                  </Text>
                </View>
              ) : (
                sections.map((s) => (
                  <RecShelf key={s.id} section={s} baseUrl={baseUrl} onDark />
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
