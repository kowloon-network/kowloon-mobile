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
  const src = embed.embedUrl + (embed.embedUrl.includes("?") ? "&" : "?") + "autoplay=1";
  const allow = embed.allow || "autoplay; encrypted-media; picture-in-picture; fullscreen";

  // Wrap the iframe in a document with a real baseUrl instead of navigating the
  // WebView straight to the embed URL. Loaded as a top-level page, YouTube's
  // embed gets no referrer/origin and shows "Video player configuration error"
  // (Error 153); giving the host document an origin fixes it — the same origin
  // the web frontend's iframe already has.
  const html = `<!DOCTYPE html><html><head>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">` +
    `<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}` +
    `iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}</style></head>` +
    `<body><iframe src="${src.replace(/&/g, "&amp;")}" allow="${allow}" allowfullscreen></iframe></body></html>`;

  return (
    <View
      className="w-full mb-3 overflow-hidden bg-black"
      style={{ aspectRatio: ratio }}
    >
      {playing ? (
        <WebView
          source={{ html, baseUrl: "https://www.youtube.com" }}
          originWhitelist={["*"]}
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
