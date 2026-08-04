// EmbedPlayer — inline rich-media player for recognized providers (YouTube, …).
//
// Facade (poster + play button) that mounts a WebView only on tap, so feeds stay
// light and nothing autoplays unbidden. The player URL comes from the trusted
// embed descriptor (@kowloon/client resolveEmbed), built from a validated id —
// never from user markup. react-native-webview is already a dependency, so no
// new native module is introduced.

import { useState } from "react";
import { View, Pressable, Image } from "react-native";
import { WebView } from "react-native-webview";
import { Play } from "lucide-react-native";

export function EmbedPlayer({ embed, poster }) {
  const [playing, setPlaying] = useState(false);
  if (!embed?.embedUrl) return null;

  const ratio = embed.aspectRatio || 16 / 9;
  const thumb = embed.thumbnail || poster;
  const src = playing
    ? embed.embedUrl + (embed.embedUrl.includes("?") ? "&" : "?") + "autoplay=1"
    : null;

  return (
    <View
      className="w-full mb-3 overflow-hidden bg-black"
      style={{ aspectRatio: ratio }}
    >
      {playing ? (
        <WebView
          source={{ uri: src }}
          style={{ flex: 1, backgroundColor: "#000000" }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
        />
      ) : (
        <Pressable
          onPress={() => setPlaying(true)}
          className="flex-1 items-center justify-center"
          android_ripple={{ color: "rgba(255,255,255,0.12)" }}
        >
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              style={{ position: "absolute", width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : null}
          <View
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.25)",
            }}
          />
          <View
            className="w-16 h-16 items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          >
            <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </Pressable>
      )}
    </View>
  );
}
