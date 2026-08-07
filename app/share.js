// Share chooser (issue #82) — when a URL is shared into Kowloon from the OS
// share sheet, let the user pick where it lands: a Link post (to their feed) or
// a private bookmark. Reached via ShareIntentRouter with ?url=<shared link>.

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Bookmark as BookmarkIcon, ChevronRight, Link2, X } from "lucide-react-native";

import { BookmarkComposer } from "../src/components/bookmarks/BookmarkComposer.jsx";
import { useActiveClient } from "../src/lib/useActiveClient.js";
import { useInk } from "../src/lib/useInk.js";

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return String(url || "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  }
}

function Choice({ icon, title, subtitle, onPress }) {
  const ink = useInk();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-center bg-white px-4 py-4 mb-3"
    >
      <View className="bg-secondary items-center justify-center" style={{ width: 44, height: 44 }}>
        {icon}
      </View>
      <View className="flex-1 ml-3 min-w-0">
        <Text className="font-ui text-base text-base-content font-bold">{title}</Text>
        <Text className="font-ui text-xs text-base-content/55 mt-0.5" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={ink(0.35)} strokeWidth={2} />
    </Pressable>
  );
}

export default function ShareChooser() {
  const params = useLocalSearchParams();
  const shared = typeof params.url === "string" ? params.url : Array.isArray(params.url) ? params.url[0] : "";
  const client = useActiveClient();
  const currentUser = client?.auth?.getUser?.() || null;
  const [bookmarking, setBookmarking] = useState(false);
  const ink = useInk();

  function dismiss() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/feed");
  }
  function toLink() {
    router.replace(`/compose?type=Link&href=${encodeURIComponent(shared)}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-4">
        <Text className="font-ui text-lg text-base-content">Share to Kowloon</Text>
        <Pressable onPress={dismiss} hitSlop={12}>
          <X size={22} color={ink(0.6)} strokeWidth={2} />
        </Pressable>
      </View>

      <View className="px-5">
        {/* Shared link preview */}
        <View className="bg-white px-4 py-3 mb-6">
          <Text className="font-ui text-[10px] uppercase tracking-[0.16em] text-base-content/45 mb-1">
            Shared link
          </Text>
          <Text className="font-ui text-sm text-base-content" numberOfLines={2}>
            {shared || "No link found."}
          </Text>
          {shared ? (
            <Text className="font-ui text-xs text-base-content/45 mt-1">{hostOf(shared)}</Text>
          ) : null}
        </View>

        {shared ? (
          <>
            <Choice
              icon={<Link2 size={20} color="#FAF4E8" strokeWidth={1.75} />}
              title="Create a Link post"
              subtitle="Share it to your feed with a preview."
              onPress={toLink}
            />
            <Choice
              icon={<BookmarkIcon size={20} color="#FAF4E8" strokeWidth={1.75} />}
              title="Save as a bookmark"
              subtitle="Keep it privately in your bookmarks."
              onPress={() => setBookmarking(true)}
            />
          </>
        ) : (
          <Pressable onPress={dismiss} className="self-center py-3">
            <Text className="font-ui uppercase tracking-widest text-xs text-base-content/50">
              Close
            </Text>
          </Pressable>
        )}
      </View>

      {currentUser ? (
        <BookmarkComposer
          visible={bookmarking}
          onClose={() => setBookmarking(false)}
          onSaved={dismiss}
          initialValues={{ href: shared }}
          client={client}
          currentUser={currentUser}
        />
      ) : null}
    </SafeAreaView>
  );
}
