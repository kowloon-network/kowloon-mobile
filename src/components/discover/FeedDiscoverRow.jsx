// FeedDiscoverRow — a single horizontal row of square cards pulled from the same
// curated pool as the Discover screen (getRecommendations). Rendered as the feed
// list header on the Community Posts view only (gated by the caller). Mixed,
// shuffled content: Posts (media + text), Circles, Groups, Pages, Bookmarks,
// Servers. Mirror of the web FeedDiscoverRow.

import { useEffect, useState } from "react";
import { View, Text, Pressable, Image, ScrollView, Linking } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  Newspaper,
  Globe,
  Bookmark as BookmarkIcon,
  FileText,
} from "lucide-react-native";

import { Avatar } from "../posts/Avatar.jsx";
import { CircleAvatar } from "../circles/CircleAvatar.jsx";
import { GroupAvatar } from "../groups/GroupAvatar.jsx";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";

const SQUARE = 168;
const MAX = 18;
const sq = { width: SQUARE, height: SQUARE };

function LinkSquare({ item, Icon, onPress }) {
  const blurb = item.summary || item.description;
  return (
    <Pressable onPress={onPress} style={sq} className="bg-base-100 border border-base-300 p-3">
      <View className="flex-row items-center mb-1.5">
        <Icon size={11} color="rgba(26,26,32,0.45)" strokeWidth={1.75} />
        <Text className="font-ui uppercase tracking-[0.16em] text-[9px] text-base-content/45 ml-1.5">
          {item.refType}
        </Text>
      </View>
      <Text className="font-ui text-sm font-bold text-base-content leading-snug" numberOfLines={2}>
        {item.title || item.name}
      </Text>
      {blurb ? (
        <Text className="font-ui text-[11px] text-base-content/70 leading-snug mt-1" numberOfLines={3}>
          {blurb}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SquareCard({ item, baseUrl, router }) {
  switch (item.refType) {
    case "Post": {
      const img = resolveImageUrl(item.featuredImage || item.mediaImage, baseUrl);
      const author = item.actor || {};
      const text = item.title || item.summary || item.preview || "";
      if (img) {
        return (
          <Pressable
            onPress={() => router.push(`/post/${encodeURIComponent(item.id)}`)}
            style={sq}
            className="bg-base-300 overflow-hidden"
          >
            <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            <View className="absolute left-0 right-0 bottom-0 h-24 bg-black/50" />
            <View className="absolute left-0 right-0 bottom-0 p-2.5">
              {text ? (
                <Text className="font-ui text-[11px] font-bold text-white leading-snug" numberOfLines={2}>
                  {text}
                </Text>
              ) : null}
              <View className="flex-row items-center mt-1.5">
                <Avatar actor={author} size={16} baseUrl={baseUrl} />
                <Text className="font-ui text-[10px] text-white/90 ml-1.5 flex-1" numberOfLines={1}>
                  {author.name || author.id}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      }
      return (
        <Pressable
          onPress={() => router.push(`/post/${encodeURIComponent(item.id)}`)}
          style={sq}
          className="bg-base-200 p-3"
        >
          <View className="flex-row items-center mb-1.5">
            <Newspaper size={11} color="rgba(26,26,32,0.45)" strokeWidth={1.75} />
            <Text className="font-ui uppercase tracking-[0.16em] text-[9px] text-base-content/45 ml-1.5">
              {item.type || "Post"}
            </Text>
          </View>
          <Text className="font-ui text-[11px] text-base-content leading-snug flex-1" numberOfLines={5}>
            {text}
          </Text>
          <View className="flex-row items-center mt-2">
            <Avatar actor={author} size={16} baseUrl={baseUrl} />
            <Text className="font-ui text-[10px] text-base-content/60 ml-1.5 flex-1" numberOfLines={1}>
              {author.name || author.id}
            </Text>
          </View>
        </Pressable>
      );
    }
    case "Circle":
      return (
        <Pressable
          onPress={() => router.push(`/circle/${encodeURIComponent(item.id)}`)}
          style={sq}
          className="bg-base-100 border border-base-300 p-3"
        >
          <CircleAvatar circle={item} size={40} baseUrl={baseUrl} />
          <Text className="font-ui text-sm font-bold text-base-content mt-2" numberOfLines={1}>
            {item.name}
          </Text>
          {typeof item.memberCount === "number" && item.memberCount > 0 ? (
            <Text className="font-ui text-[10px] uppercase tracking-[0.14em] text-base-content/45 mt-0.5">
              {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
            </Text>
          ) : null}
          {item.summary ? (
            <Text className="font-ui text-[11px] text-base-content/70 leading-snug mt-1" numberOfLines={3}>
              {item.summary}
            </Text>
          ) : null}
        </Pressable>
      );
    case "Group":
      return (
        <Pressable
          onPress={() => router.push(`/group/${encodeURIComponent(item.id)}`)}
          style={sq}
          className="bg-base-100 border border-base-300 p-3"
        >
          <GroupAvatar group={item} size={40} baseUrl={baseUrl} />
          <Text className="font-ui text-sm font-bold text-base-content mt-2" numberOfLines={1}>
            {item.name}
          </Text>
          {typeof item.memberCount === "number" && item.memberCount > 0 ? (
            <Text className="font-ui text-[10px] uppercase tracking-[0.14em] text-base-content/45 mt-0.5">
              {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
            </Text>
          ) : null}
          {item.description ? (
            <Text className="font-ui text-[11px] text-base-content/70 leading-snug mt-1" numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
        </Pressable>
      );
    case "Page":
      return (
        <LinkSquare
          item={item}
          Icon={FileText}
          onPress={() => item.url && Linking.openURL(item.url).catch(() => {})}
        />
      );
    case "Bookmark":
      return (
        <LinkSquare
          item={item}
          Icon={BookmarkIcon}
          onPress={() => item.href && Linking.openURL(item.href).catch(() => {})}
        />
      );
    case "Server":
      return (
        <LinkSquare
          item={item}
          Icon={Globe}
          onPress={() => router.push(`/server/${encodeURIComponent(item.domain)}`)}
        />
      );
    default:
      return null;
  }
}

export function FeedDiscoverRow() {
  const client = useActiveClient();
  const baseUrl = client?.http?.baseUrl;
  const router = useRouter();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds
      .getRecommendations()
      .then((res) => {
        if (cancelled) return;
        const seen = new Set();
        const flat = [];
        for (const s of res?.sections ?? []) {
          for (const it of s?.items ?? []) {
            const k = `${it.refType}:${it.id}`;
            if (seen.has(k)) continue;
            seen.add(k);
            flat.push(it);
          }
        }
        // Shuffle so object types are mixed, not clustered by curated section.
        for (let i = flat.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [flat[i], flat[j]] = [flat[j], flat[i]];
        }
        setItems(flat.slice(0, MAX));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (items.length === 0) return null;

  return (
    <View className="pt-1 pb-4">
      <View className="flex-row items-center justify-between mb-2 px-5">
        <Text className="font-ui text-lg font-bold text-base-content">Discover</Text>
        <Pressable onPress={() => router.push("/discover")} hitSlop={8} className="flex-row items-center">
          <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/50 mr-0.5">
            See all
          </Text>
          <ChevronRight size={12} color="rgba(26,26,32,0.5)" />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        {items.map((item, i) => (
          <View key={`${item.refType}:${item.id}:${i}`} style={{ marginRight: 12 }}>
            <SquareCard item={item} baseUrl={baseUrl} router={router} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
