// RecCard — renders one Discover recommendation, dispatched by refType.
//
// Post   : featured-image card with author + summary overlaid (text fallback).
// Circle : icon + name + blurb, with View / Save actions.
// Group  : avatar + name + blurb, with View / See Posts actions.
// Bookmark/Page: compact link card.

import { useState } from "react";
import { Alert, Image, Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { Bookmark as BookmarkIcon, Copy, ExternalLink, Globe, Newspaper, Play, Users } from "lucide-react-native";

import { Avatar } from "../posts/Avatar.jsx";
import { CircleAvatar } from "../circles/CircleAvatar.jsx";
import { GroupAvatar } from "../groups/GroupAvatar.jsx";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";
import { saveCircle } from "../../lib/saveCircle.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";

const CARD_W = 244;
const POST_W = 288;

function MiniButton({ label, onPress, filled, disabled, icon }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      className={`flex-1 flex-row items-center justify-center px-2 py-2  ${
        filled ? "bg-primary " : "bg-base-200 "
      }`}
    >
      {icon}
      <Text
        className={`font-ui uppercase tracking-[0.12em] text-[10px] ${
          filled ? "text-primary-content" : "text-base-content"
        } ${icon ? "ml-1" : ""}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const POST_H = 200; // uniform post-card height across the row
function PostCard({ item, baseUrl, onPress }) {
  const img = resolveImageUrl(item.featuredImage, baseUrl);
  const author = item.actor || {};
  const title = item.title || null;
  const preview = item.preview || item.summary || "";
  const overlayText = title || preview;
  if (img) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        style={{ width: POST_W, height: POST_H }}
        className="bg-base-300 mr-3"
      >
        <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        {/* Bottom scrim for legibility */}
        <View className="absolute left-0 right-0 bottom-0 h-28 bg-black/45" />
        <View className="absolute left-0 right-0 bottom-0 p-3">
          <Text className="font-ui text-sm font-bold text-white leading-snug" numberOfLines={2}>
            {overlayText}
          </Text>
          <View className="flex-row items-center mt-2">
            <Avatar actor={author} size={20} baseUrl={baseUrl} />
            <Text className="font-ui text-[11px] text-white/90 ml-2" numberOfLines={1}>
              {author.name || author.id}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }
  // Text card — Notes have no title, so lead with the body preview. Content
  // fills the middle; the author is pinned to the bottom.
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      style={{ width: CARD_W, height: POST_H }}
      className="bg-base-200 p-3 mr-3"
    >
      <View className="flex-row items-center mb-2">
        <Newspaper size={12} color="rgba(26,26,32,0.5)" strokeWidth={1.75} />
        <Text className="font-ui uppercase tracking-[0.16em] text-[9px] text-base-content/45 ml-1.5">
          {item.type || "Post"}
        </Text>
      </View>
      <View className="flex-1">
        {title ? (
          <Text className="font-ui text-sm font-bold text-base-content leading-snug" numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {preview ? (
          <Text
            className="font-ui text-[13px] text-base-content/75 leading-relaxed mt-1"
            numberOfLines={title ? 3 : 6}
          >
            {preview}
          </Text>
        ) : !title ? (
          <Text className="font-ui text-sm text-base-content/40 italic">No preview.</Text>
        ) : null}
      </View>
      <View className="flex-row items-center mt-2">
        <Avatar actor={author} size={20} baseUrl={baseUrl} />
        <Text className="font-ui text-[11px] text-base-content/60 ml-2" numberOfLines={1}>
          {author.name || author.id}
        </Text>
      </View>
    </Pressable>
  );
}

function CircleCard({ item, baseUrl, onView }) {
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isOwn = (item.actorId || null) === account?.id;

  async function handleSave() {
    if (saving || saved) return;
    setSaving(true);
    try {
      await saveCircle(client, item.id);
      setSaved(true);
    } catch (e) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      style={{ width: CARD_W }}
      className="  bg-base-100 p-3 mr-3"
    >
      <View className="flex-row items-center">
        <CircleAvatar circle={item} size={40} baseUrl={baseUrl} />
        <View className="flex-1 ml-3 min-w-0">
          <Text className="font-ui text-sm font-bold text-base-content" numberOfLines={1}>
            {item.name}
          </Text>
          {typeof item.memberCount === "number" && item.memberCount > 0 ? (
            <Text className="font-ui text-[10px] uppercase tracking-[0.14em] text-base-content/45 mt-0.5">
              {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
            </Text>
          ) : null}
        </View>
      </View>
      {item.summary ? (
        <Text className="font-ui text-xs text-base-content/70 leading-relaxed mt-2" numberOfLines={2}>
          {item.summary}
        </Text>
      ) : null}
      <View className="flex-row mt-3" style={{ gap: 8 }}>
        <MiniButton label="View" onPress={onView} />
        {isOwn ? null : (
          <MiniButton
            label={saved ? "Saved" : saving ? "..." : "Save"}
            onPress={handleSave}
            disabled={saving || saved}
            filled={!saved}
            icon={saved ? null : <Copy size={11} color="#FAF4E8" strokeWidth={1.75} />}
          />
        )}
      </View>
    </View>
  );
}

function GroupCard({ item, baseUrl, onView, onPosts }) {
  return (
    <View
      style={{ width: CARD_W }}
      className="  bg-base-100 p-3 mr-3"
    >
      <View className="flex-row items-center">
        <GroupAvatar group={item} size={40} baseUrl={baseUrl} />
        <View className="flex-1 ml-3 min-w-0">
          <Text className="font-ui text-sm font-bold text-base-content" numberOfLines={1}>
            {item.name}
          </Text>
          {typeof item.memberCount === "number" && item.memberCount > 0 ? (
            <Text className="font-ui text-[10px] uppercase tracking-[0.14em] text-base-content/45 mt-0.5">
              {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
            </Text>
          ) : null}
        </View>
      </View>
      {item.description ? (
        <Text className="font-ui text-xs text-base-content/70 leading-relaxed mt-2" numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <View className="flex-row mt-3" style={{ gap: 8 }}>
        <MiniButton label="View" onPress={onView} />
        <MiniButton label="Posts" onPress={onPosts} icon={<Users size={11} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />} />
      </View>
    </View>
  );
}

function LinkCard({ item, baseUrl, icon, onPress }) {
  const img = resolveImageUrl(item.image, baseUrl);
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      style={{ width: CARD_W }}
      className="  bg-base-100 mr-3"
    >
      {img ? (
        <Image source={{ uri: img }} style={{ width: "100%", height: 110 }} resizeMode="cover" />
      ) : null}
      <View className="p-3">
        <View className="flex-row items-center mb-1">
          {icon}
          <Text className="font-ui uppercase tracking-[0.16em] text-[9px] text-base-content/45 ml-1.5">
            {item.refType}
          </Text>
        </View>
        <Text className="font-ui text-sm font-bold text-base-content leading-snug" numberOfLines={2}>
          {item.title}
        </Text>
        {item.summary ? (
          <Text className="font-ui text-xs text-base-content/65 leading-relaxed mt-1" numberOfLines={2}>
            {item.summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// Compact media thumbnail for the Media row — each image/video links to its
// original post. Video posts get a play badge (we can't cheaply poster-frame a
// video, so we show the thumbnail image when present, else a dark tile).
const MEDIA_W = 150;
export function MediaCard({ item, baseUrl }) {
  const router = useRouter();
  const img = resolveImageUrl(item.mediaImage || item.featuredImage, baseUrl);
  const isVideo = /video/i.test(item.type || "") || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(item.mediaImage || "");
  return (
    <Pressable
      onPress={() => router.push(`/post/${encodeURIComponent(item.id)}`)}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      style={{ width: MEDIA_W, height: MEDIA_W }}
      className="mr-2 bg-base-300"
    >
      {img ? (
        <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Newspaper size={22} color="rgba(26,26,32,0.35)" strokeWidth={1.5} />
        </View>
      )}
      {isVideo ? (
        <View
          className="absolute items-center justify-center bg-black/45"
          style={{ width: 34, height: 34, borderRadius: 17, right: 8, bottom: 8 }}
        >
          <Play size={16} color="#fff" fill="#fff" strokeWidth={0} />
        </View>
      ) : null}
    </Pressable>
  );
}

function ServerCard({ item, baseUrl, onPress }) {
  const [iconFailed, setIconFailed] = useState(false);
  const icon = resolveImageUrl(item.icon, baseUrl);
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      style={{ width: CARD_W }}
      className="bg-base-100 p-3 mr-3"
    >
      <View className="flex-row items-center">
        {icon && !iconFailed ? (
          <Image
            source={{ uri: icon }}
            style={{ width: 40, height: 40 }}
            className="bg-base-200"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <View style={{ width: 40, height: 40 }} className="bg-secondary items-center justify-center">
            <Globe size={20} color="rgba(255,244,224,0.75)" strokeWidth={1.75} />
          </View>
        )}
        <View className="flex-1 ml-3 min-w-0">
          <Text className="font-ui text-sm font-bold text-base-content" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="font-ui text-[10px] uppercase tracking-[0.14em] text-base-content/45 mt-0.5" numberOfLines={1}>
            {item.domain}
            {typeof item.userCount === "number" ? `  ·  ${item.userCount.toLocaleString()} users` : ""}
          </Text>
        </View>
      </View>
      {item.description ? (
        <Text className="font-ui text-xs text-base-content/70 leading-relaxed mt-2" numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <View className="flex-row mt-3" style={{ gap: 8 }}>
        <MiniButton label="Visit" onPress={onPress} icon={<Globe size={11} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />} />
      </View>
    </Pressable>
  );
}

export function RecCard({ item, baseUrl }) {
  const router = useRouter();
  const enc = (id) => encodeURIComponent(id);

  switch (item.refType) {
    case "Post":
      return (
        <PostCard
          item={item}
          baseUrl={baseUrl}
          onPress={() => router.push(`/post/${enc(item.id)}`)}
        />
      );
    case "Circle":
      return (
        <CircleCard
          item={item}
          baseUrl={baseUrl}
          onView={() => router.push(`/circle/${enc(item.id)}`)}
        />
      );
    case "Group":
      return (
        <GroupCard
          item={item}
          baseUrl={baseUrl}
          onView={() => router.push(`/group/${enc(item.id)}`)}
          onPosts={() => router.push(`/feed?view=${enc(item.id)}`)}
        />
      );
    case "Bookmark":
      return (
        <LinkCard
          item={item}
          baseUrl={baseUrl}
          icon={<BookmarkIcon size={12} color="rgba(26,26,32,0.5)" strokeWidth={1.75} />}
          onPress={() => item.href && Linking.openURL(item.href).catch(() => {})}
        />
      );
    case "Page":
      return (
        <LinkCard
          item={item}
          baseUrl={baseUrl}
          icon={<ExternalLink size={12} color="rgba(26,26,32,0.5)" strokeWidth={1.75} />}
          onPress={() => item.url && Linking.openURL(item.url).catch(() => {})}
        />
      );
    case "Server":
      return (
        <ServerCard
          item={item}
          baseUrl={baseUrl}
          onPress={() => router.push(`/server/${enc(item.domain)}`)}
        />
      );
    default:
      return null;
  }
}
