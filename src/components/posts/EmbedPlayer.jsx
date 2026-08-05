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
import { EMBED_WEBVIEW_USER_AGENT } from "@kowloon/client";

export function EmbedPlayer({ embed, poster }) {
  const [playing, setPlaying] = useState(false);
  if (!embed?.embedUrl) return null;

  const ratio = embed.aspectRatio || 16 / 9;
  const thumb = embed.thumbnail || poster;
  const allow = embed.allow || "autoplay; encrypted-media; picture-in-picture; fullscreen";

  // Mirror the web frontend's working setup: a plain iframe in a document with a
  // real origin (baseUrl). The extra piece a WebView needs is the User-Agent —
  // Android System WebView's default UA carries a "wv" token that YouTube treats
  // as an unsupported context and answers with "video unavailable" (Error 152).
  // Overriding to a normal Chrome UA makes it behave like the browser embed.
  const src = embed.embedUrl + (embed.embedUrl.includes("?") ? "&" : "?") + "autoplay=1";
  const baseUrl = (embed.embedUrl.match(/^https?:\/\/[^/]+/) || ["https://www.youtube.com"])[0];
  const html =
    `<!DOCTYPE html><html><head>` +
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
          source={{ html, baseUrl }}
          userAgent={EMBED_WEBVIEW_USER_AGENT}
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
