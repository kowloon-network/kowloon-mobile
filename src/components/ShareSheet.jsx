// ShareSheet -- what you see when you share something INTO Kowloon from
// another app (Feedly, a browser, Photos...).
//
// Why a sheet and not an automatic jump to a screen: the old design
// (ShareIntentRouter, issue #86) navigated to the composer by itself as soon
// as a share arrived. On Android that navigation, fired from a background
// effect rather than a touch, was silently ignored most of the time -- twelve
// different fixes failed. The SAME router.push() fired from a tap worked
// every time. So this never navigates on its own: it shows a native Modal
// over whatever screen is up (a Modal needs no navigation), and the person's
// tap on a choice does the push.
//
// Mounted inside the feed tab (app/(tabs)/feed.js), which stays mounted under
// every other screen once signed in. A share that arrives while signed out
// simply waits (ShareIntentProvider has resetOnBackground:false) and the sheet
// appears once the feed mounts after sign-in.
//
//   URL   -> Create a Link post | Save as a bookmark
//   text  -> Write a post (Note, text prefilled)
//   files -> Post these (Media, attached)

import { useEffect, useState } from "react";
import { AppState, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useShareIntentContext } from "expo-share-intent";
import { Bookmark as BookmarkIcon, ChevronRight, Image as ImageIcon, Link2, PenLine, X } from "lucide-react-native";

import { setPendingShare } from "../lib/pendingShare.js";
import { useInk } from "../lib/useInk.js";

const URL_RE = /https?:\/\/\S+/i;

// What was shared, in one shape.
export function describeShare(si) {
  if (!si) return null;
  const text = typeof si.text === "string" ? si.text : "";
  const url = si.webUrl || (text.match(URL_RE) || [])[0] || null;
  if (url) return { kind: "url", url, text };
  if (Array.isArray(si.files) && si.files.length) return { kind: "files", files: si.files };
  if (text.trim()) return { kind: "text", text };
  return null;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return String(url || "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  }
}

function Choice({ icon, title, subtitle, onPress, testID }) {
  const ink = useInk();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-center bg-field px-4 py-4 mb-3"
    >
      <View className="bg-secondary items-center justify-center" style={{ width: 44, height: 44 }}>
        {icon}
      </View>
      <View className="flex-1 ml-3 min-w-0">
        <Text className="font-ui text-base text-base-content font-bold">{title}</Text>
        {subtitle ? (
          <Text className="font-ui text-xs text-base-content/55 mt-0.5" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={ink(0.35)} strokeWidth={2} />
    </Pressable>
  );
}

function Preview({ share }) {
  if (share.kind === "url") {
    return (
      <View className="bg-field px-4 py-3 mb-5">
        <Text className="font-ui text-[10px] uppercase tracking-[0.16em] text-base-content/45 mb-1">
          Link
        </Text>
        <Text className="font-ui text-sm text-base-content" numberOfLines={2}>
          {share.url}
        </Text>
        <Text className="font-ui text-xs text-base-content/45 mt-1">{hostOf(share.url)}</Text>
      </View>
    );
  }
  if (share.kind === "text") {
    return (
      <View className="bg-field px-4 py-3 mb-5">
        <Text className="font-ui text-sm text-base-content" numberOfLines={4}>
          {share.text}
        </Text>
      </View>
    );
  }
  const images = share.files.filter((f) => String(f.mimeType || "").startsWith("image/"));
  return (
    <View className="mb-5">
      <View className="flex-row" style={{ gap: 6 }}>
        {images.slice(0, 4).map((f) => (
          <Image
            key={f.path}
            source={{ uri: f.path }}
            style={{ width: 64, height: 64 }}
            contentFit="cover"
          />
        ))}
      </View>
      <Text className="font-ui text-xs text-base-content/55 mt-2">
        {share.files.length === 1 ? "1 file" : `${share.files.length} files`}
      </Text>
    </View>
  );
}

export function ShareSheet() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const ink = useInk();

  // Android: a native Modal is a Dialog bound to whatever Activity is current
  // at the moment it is created. A share arrives while the throwaway share
  // Activity (see src/lib/singleRoot.js) is still current and finishing, so
  // the Dialog gets built on it and is never shown -- and when the real
  // Activity resumes, RN only updates the existing Dialog's props, it never
  // re-shows it. Result: the first share opened the app with no sheet; the
  // second worked. Fix: remount the Modal every time the app becomes active,
  // so its Dialog is always created on the Activity actually on screen.
  const [activeKey, setActiveKey] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") setActiveKey((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const share = hasShareIntent ? describeShare(shareIntent) : null;

  // Done with this share (acted on or cancelled): clear it, which closes the
  // sheet. Android's "reopen from Recents" replay of an old share is dropped
  // natively (patches/expo-share-intent+8.0.1.patch); if one ever slipped
  // through, it would only show this sheet again, never post anything.
  function finish() {
    try { resetShareIntent?.(); } catch {}
  }

  // Every navigation below runs inside onPress -- see the header comment.
  function go(href) {
    router.push(href);
    finish();
  }

  function postLink() {
    // Feedly and browsers often send "Article title https://..." -- keep the
    // title part as the Link post's title.
    const title = share.text.replace(share.url, "").replace(/\s+/g, " ").trim();
    go(
      `/compose?type=Link&href=${encodeURIComponent(share.url)}` +
        (title ? `&title=${encodeURIComponent(title)}` : "")
    );
  }
  function bookmarkLink() {
    go(`/share?url=${encodeURIComponent(share.url)}&mode=bookmark`);
  }
  function postText() {
    setPendingShare({ kind: "text", text: share.text });
    go("/compose?fromShare=1");
  }
  function postFiles() {
    setPendingShare({
      kind: "files",
      files: share.files.map((f) => ({ uri: f.path, name: f.fileName, mimeType: f.mimeType })),
    });
    go("/compose?fromShare=1");
  }

  if (!share) return null;

  const onLight = "#FAF4E8";
  return (
    <Modal key={activeKey} visible transparent animationType="fade" onRequestClose={finish} statusBarTranslucent>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={finish}>
        <Pressable onPress={() => {}}>
          <SafeAreaView edges={["bottom"]} className="bg-base-100">
            <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
              <Text className="font-ui text-lg text-base-content">Share to Kowloon</Text>
              <Pressable onPress={finish} hitSlop={12} accessibilityLabel="Cancel">
                <X size={22} color={ink(0.6)} strokeWidth={2} />
              </Pressable>
            </View>
            <View className="px-5 pb-4">
              <Preview share={share} />
              {share.kind === "url" ? (
                <>
                  <Choice
                    testID="share-link-post"
                    icon={<Link2 size={20} color={onLight} strokeWidth={1.75} />}
                    title="Create a Link post"
                    subtitle="Share it with a preview."
                    onPress={postLink}
                  />
                  <Choice
                    testID="share-bookmark"
                    icon={<BookmarkIcon size={20} color={onLight} strokeWidth={1.75} />}
                    title="Save as a bookmark"
                    subtitle="Keep it in your bookmarks."
                    onPress={bookmarkLink}
                  />
                </>
              ) : share.kind === "text" ? (
                <Choice
                  testID="share-text-post"
                  icon={<PenLine size={20} color={onLight} strokeWidth={1.75} />}
                  title="Write a post"
                  subtitle="Starts a post with this text."
                  onPress={postText}
                />
              ) : (
                <Choice
                  testID="share-files-post"
                  icon={<ImageIcon size={20} color={onLight} strokeWidth={1.75} />}
                  title="Post these"
                  subtitle="Starts a post with these attached."
                  onPress={postFiles}
                />
              )}
              <Pressable onPress={finish} className="self-center py-3">
                <Text className="font-ui uppercase tracking-widest text-xs text-base-content/50">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
