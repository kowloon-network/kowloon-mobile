// Ellipsis (more options) menu for a post — rendered as a positional Modal
// anchored below-right of the trigger, using the same measureInWindow pattern
// as FeedViewSelector and PostTypeDropdown.
//
// No statusBarTranslucent: measureInWindow returns y below the status bar,
// and statusBarTranslucent would shift the Modal origin to the physical top,
// causing an upward offset equal to the status bar height on Android.

import { useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Ban,
  BellOff,
  Copy,
  ExternalLink,
  Flag,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react-native";
// expo-clipboard requires a native module. Guard against builds where the
// correct SDK-matched version wasn't included at native compile time.
let Clipboard;
try {
  Clipboard = require("expo-clipboard");
} catch {
  Clipboard = { setStringAsync: async () => {} };
}
import { FlagSheet } from "./FlagSheet.jsx";
import { useInk } from "../../lib/useInk.js";

const DROPDOWN_WIDTH = 210;
const ICON_SIZE = 15;
const STROKE = 1.75;
const COLOR_DANGER = "#CC272E";

function postUrl(client, post) {
  if (post?.url) return post.url;
  const base = client?.http?.baseUrl;
  const id = post?.id;
  if (!base || !id) return null;
  return `${base.replace(/\/$/, "")}/posts/${encodeURIComponent(id)}`;
}

export function PostMoreMenu({ post, client, currentUser, onDeleted }) {
  const router = useRouter();
  const ink = useInk();
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const shareUrl = postUrl(client, post);
  const authorId = post?.actor?.id || post?.actorId;
  const isOwner =
    !!currentUser?.id &&
    (currentUser.id === authorId || currentUser.id === post?.actorId);
  const isSelf = !!currentUser?.id && currentUser.id === authorId;
  const [flagOpen, setFlagOpen] = useState(false);

  function openMenu() {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      // Right-align the dropdown under the trigger; clamp so it doesn't clip the left edge.
      const left = Math.max(8, x + w - DROPDOWN_WIDTH);
      setDropPos({ top: y + h + 4, left });
      setOpen(true);
    });
  }

  function close() {
    setOpen(false);
  }

  // --- Action handlers -------------------------------------------------------

  function handleEdit() {
    close();
    router.push(`/post/${encodeURIComponent(String(post.id))}/edit`);
  }

  function handleDelete() {
    close();
    Alert.alert(
      "Delete post?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await client.activities.deletePost({ postId: post.id });
              onDeleted?.();
            } catch (e) {
              Alert.alert("Couldn't delete", e?.message || "Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  function handleFlag() {
    close();
    setFlagOpen(true);
  }

  async function submitFlag(reason) {
    setFlagOpen(false);
    try {
      await client.activities.flag({ targetId: post.id, reason });
      Alert.alert("Reported", "Thanks — a moderator will review this post.");
    } catch (e) {
      Alert.alert("Couldn't report", e?.message || "Please try again.");
    }
  }

  function handleBlock() {
    close();
    const name = post?.actor?.name || authorId || "this user";
    Alert.alert(
      `Block ${name}?`,
      "They won't be able to interact with you and their posts won't appear in your feed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await client.activities.block({ userId: authorId });
            } catch (e) {
              Alert.alert("Couldn't block", e?.message || "Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  function handleMute() {
    close();
    const name = post?.actor?.name || authorId || "this user";
    Alert.alert(
      `Mute ${name}?`,
      "Their posts won't appear in your feed. You can undo this from your settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "destructive",
          onPress: async () => {
            try {
              await client.activities.mute({ userId: authorId });
            } catch (e) {
              Alert.alert("Couldn't mute", e?.message || "Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  async function handleCopyLink() {
    close();
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
    } catch {
      // silently ignore — rare failure on clipboard unavailable
    }
  }

  // React Native can't select text across separate paragraphs, so "select the
  // whole post" is impossible in the rendered body (#59). Offer a one-tap copy
  // of the full text instead. Prefer the Markdown source; fall back to stripping
  // the rendered HTML.
  async function handleCopyText() {
    close();
    const raw = post?.source?.content || post?.textPreview || post?.body || "";
    const text = String(raw)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  async function handleOpenBrowser() {
    close();
    if (!shareUrl) return;
    try {
      await Linking.openURL(shareUrl);
    } catch {
      // silently ignore unsupported or malformed URL
    }
  }

  // --- Build item list -------------------------------------------------------

  const items = [];

  if (isOwner) {
    items.push({ key: "edit", Icon: Pencil, label: "Edit", onPress: handleEdit });
    items.push({
      key: "delete",
      Icon: Trash2,
      label: "Delete",
      danger: true,
      onPress: handleDelete,
    });
  }

  if (currentUser) {
    if (items.length > 0) items.push({ key: "sep1", sep: true });
    items.push({ key: "flag", Icon: Flag, label: "Flag", onPress: handleFlag });
    // Don't offer block/mute on your own posts.
    if (!isSelf && authorId) {
      items.push({
        key: "block",
        Icon: Ban,
        label: "Block Author",
        onPress: handleBlock,
      });
      items.push({
        key: "mute",
        Icon: BellOff,
        label: "Mute Author",
        onPress: handleMute,
      });
    }
  }

  if (post?.source?.content || post?.body || post?.textPreview) {
    const hasContent = items.some((i) => !i.sep);
    if (hasContent) items.push({ key: "septext", sep: true });
    items.push({ key: "copytext", Icon: Copy, label: "Copy Text", onPress: handleCopyText });
  }

  if (shareUrl) {
    const hasContent = items.some((i) => !i.sep);
    if (hasContent) items.push({ key: "sep2", sep: true });
    items.push({ key: "copy", Icon: Copy, label: "Copy Link", onPress: handleCopyLink });
    items.push({
      key: "browser",
      Icon: ExternalLink,
      label: "Open in Browser",
      onPress: handleOpenBrowser,
    });
  }

  // Nothing to show — don't render the trigger.
  if (!items.some((i) => !i.sep)) return null;

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        hitSlop={8}
        android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        accessibilityLabel="More options"
      >
        <MoreHorizontal size={20} color={ink(0.45)} strokeWidth={STROKE} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
      >
        {/* Transparent full-screen backdrop — tap anywhere outside to close */}
        <Pressable className="flex-1" onPress={close}>
          <Pressable
            onPress={() => {}}
            style={{
              position: "absolute",
              top: dropPos.top,
              left: dropPos.left,
              width: DROPDOWN_WIDTH,
            }}
            className="bg-base-100  "
          >
            {items.map((item) =>
              item.sep ? (
                <View key={item.key} className="h-px bg-base-200 mx-3" />
              ) : (
                <Pressable
                  key={item.key}
                  onPress={item.onPress}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  className="flex-row items-center px-4 py-3"
                >
                  <item.Icon
                    size={ICON_SIZE}
                    color={item.danger ? COLOR_DANGER : ink(0.85)}
                    strokeWidth={STROKE}
                  />
                  <Text
                    className={`font-ui text-sm ml-3 ${
                      item.danger ? "text-error" : "text-base-content"
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <FlagSheet
        visible={flagOpen}
        onClose={() => setFlagOpen(false)}
        onSubmit={submitFlag}
        client={client}
      />
    </>
  );
}
