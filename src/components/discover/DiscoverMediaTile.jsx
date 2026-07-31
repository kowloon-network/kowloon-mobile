// DiscoverMediaTile — one media thumbnail in a Discover media row / server
// landing strip. Images link to their post; video plays fullscreen; audio plays
// in-app. `mediaKind` + `mediaUrl` come from the server (GET /recommendations).

import { useEffect, useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Music, Play, X } from "lucide-react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { Avatar } from "../posts/Avatar.jsx";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";

function fmt(s) {
  if (!s || !Number.isFinite(s)) return "0:00";
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

// Fullscreen video modal — autoplays, native controls, tap X to close.
function FullscreenVideo({ uri, onClose }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View className="flex-1 bg-black">
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="contain"
          nativeControls
          allowsFullscreen
        />
        <Pressable
          onPress={onClose}
          hitSlop={14}
          className="absolute top-14 right-5 bg-black/55 p-2"
          style={{ borderRadius: 20 }}
        >
          <X size={22} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>
    </Modal>
  );
}

// In-app audio player sheet — autoplays, play/pause + progress, tap backdrop to close.
function AudioSheet({ uri, name, onClose }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    player.play();
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player]);

  const playing = status?.playing;
  const position = status?.currentTime || 0;
  const duration = status?.duration || 0;
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;

  useEffect(() => {
    if (status?.didJustFinish) player.seekTo(0).catch(() => {});
  }, [status?.didJustFinish, player]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/70 items-center justify-center px-8" onPress={onClose}>
        <Pressable className="w-full bg-base-100 p-6" onPress={() => {}}>
          <View className="flex-row items-center">
            <View className="bg-secondary items-center justify-center" style={{ width: 44, height: 44 }}>
              <Music size={20} color="#FAF4E8" strokeWidth={1.75} />
            </View>
            <Text className="font-ui text-base text-base-content flex-1 ml-3" numberOfLines={2}>
              {name || "Audio"}
            </Text>
          </View>
          <View className="flex-row items-center mt-5">
            <Pressable
              onPress={() => (playing ? player.pause() : player.play())}
              className="bg-primary items-center justify-center"
              style={{ width: 48, height: 48 }}
              android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true }}
            >
              <Text className="font-ui text-lg text-primary-content">{playing ? "⏸" : "▶"}</Text>
            </Pressable>
            <View className="flex-1 ml-4">
              <View className="h-1 bg-base-300">
                <View className="h-1 bg-primary" style={{ width: `${pct}%` }} />
              </View>
              <Text className="font-ui text-[11px] text-base-content/55 mt-1 tabular-nums">
                {fmt(position)} / {fmt(duration)}
              </Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DiscoverMediaTile({ item, size, baseUrl, showAuthor, marginRight = 0 }) {
  const [mode, setMode] = useState(null); // null | "video" | "audio"
  const kind = item.mediaKind || "image";
  const img = resolveImageUrl(item.mediaImage || item.featuredImage, baseUrl);
  const playUrl = resolveImageUrl(item.mediaUrl, baseUrl);
  const author = item.actor || {};

  function onPress() {
    if (kind === "video" && playUrl) setMode("video");
    else if (kind === "audio" && playUrl) setMode("audio");
    else router.push(`/post/${encodeURIComponent(item.id)}`);
  }

  return (
    <>
      <Pressable
        onPress={onPress}
        style={{ width: size, height: size, marginRight }}
        className="bg-base-300"
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      >
        {kind === "image" && img ? (
          <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View
            className={`flex-1 items-center justify-center ${kind === "audio" ? "bg-secondary" : "bg-neutral-800"}`}
          >
            {kind === "audio" ? (
              <Music size={26} color="rgba(255,244,224,0.9)" strokeWidth={1.75} />
            ) : (
              <Play size={30} color="#fff" fill="#fff" strokeWidth={0} />
            )}
          </View>
        )}

        {showAuthor ? (
          <>
            <View className="absolute left-0 right-0 bottom-0 h-9 bg-black/50" />
            <View className="absolute left-0 right-0 bottom-0 px-2 py-1.5 flex-row items-center">
              <Avatar actor={author} size={16} baseUrl={baseUrl} />
              <Text className="font-ui text-[10px] text-white ml-1.5 flex-1" numberOfLines={1}>
                {author.name || author.id}
              </Text>
            </View>
          </>
        ) : null}
      </Pressable>

      {mode === "video" && playUrl ? (
        <FullscreenVideo uri={playUrl} onClose={() => setMode(null)} />
      ) : null}
      {mode === "audio" && playUrl ? (
        <AudioSheet uri={playUrl} name={item.mediaName} onClose={() => setMode(null)} />
      ) : null}
    </>
  );
}
