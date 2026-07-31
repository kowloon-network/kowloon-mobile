// DiscoverMediaTile — one media thumbnail in a Discover media row / server
// landing strip. Images link to their post; video plays fullscreen; audio plays
// in-app. `mediaKind` + `mediaUrl` come from the server (GET /recommendations).

import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Music, Play, X } from "lucide-react-native";
import { useVideoPlayer, VideoView } from "expo-video";

import { Avatar } from "../posts/Avatar.jsx";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";
import { useAudioBar } from "../../lib/AudioPlayerProvider.jsx";

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

export function DiscoverMediaTile({ item, size, baseUrl, showAuthor, marginRight = 0 }) {
  const [videoOpen, setVideoOpen] = useState(false);
  const audio = useAudioBar();
  const kind = item.mediaKind || "image";
  const img = resolveImageUrl(item.mediaImage || item.featuredImage, baseUrl);
  const playUrl = resolveImageUrl(item.mediaUrl, baseUrl);
  const author = item.actor || {};

  function onPress() {
    if (kind === "video" && playUrl) setVideoOpen(true);
    else if (kind === "audio" && playUrl)
      audio?.requestTrack({ id: item.id, url: playUrl, title: item.mediaName || item.title || "Audio" });
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

      {videoOpen && playUrl ? (
        <FullscreenVideo uri={playUrl} onClose={() => setVideoOpen(false)} />
      ) : null}
    </>
  );
}
