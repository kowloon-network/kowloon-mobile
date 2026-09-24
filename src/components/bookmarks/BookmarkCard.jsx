// BookmarkCard — list row for a saved bookmark. Tap opens the external URL
// in the system browser; long-press jumps to the bookmark detail (someday).

import { Image, Linking, Pressable, Text, View } from "react-native";

import { resolveImageUrl } from "../../lib/resolveImageUrl.js";
import { timeAgo } from "@kowloon/client";

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return String(url)
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
  }
}

export function BookmarkCard({ bookmark, baseUrl }) {
  const host = hostOf(bookmark?.href);
  const image = resolveImageUrl(bookmark?.image, baseUrl);

  async function open() {
    if (!bookmark?.href) return;
    try {
      await Linking.openURL(bookmark.href);
    } catch {
      // ignore — some URLs the OS can't handle
    }
  }

  return (
    <Pressable
      onPress={open}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row px-5 py-4   bg-base-100"
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={{ width: 56, height: 56 }}
          className="  bg-base-200 mr-3"
          resizeMode="cover"
        />
      ) : null}
      <View className="flex-1 min-w-0">
        <Text
          className="font-ui text-base text-base-content leading-snug"
          numberOfLines={2}
        >
          {bookmark?.title || bookmark?.href}
        </Text>
        <View className="flex-row items-center mt-1">
          {host ? (
            <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55">
              {host}
            </Text>
          ) : null}
          {bookmark?.createdAt ? (
            <>
              {host ? (
                <Text className="font-ui text-[10px] text-base-content/40 mx-1.5">
                  ·
                </Text>
              ) : null}
              <Text className="font-ui text-[10px] text-base-content/55">
                {timeAgo(bookmark.createdAt)}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
