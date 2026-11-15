// Content warnings -- everything the app shows for them lives here, so a
// post looks the same in every feed, on the post screen, in replies and on
// Discover. The rule itself (show / warn / hide, blur) is shared with the
// web in @kowloon/client getContentWarningDecision().
//
//   useContentWarning(post) -> { stage, decision, reveal, mediaHidden, revealMedia }
//     stage: "hidden"  -- reader chose Hide for one of its categories:
//                         render <HiddenPostLine> instead of the post
//            "warned"  -- render the author row, then <WarningBar> instead
//                         of title, body and media
//            "open"    -- render the post (with <WarningChip> above the body)
//   mediaHidden: photos/video are marked sensitive -- cover them with
//                <SensitiveCover> until tapped.
//
// Plus the composer pieces: <ContentWarningButton> (toolbar icon) opens
// <ContentWarningSheet> (categories, note, blur toggle).

import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, Switch, Text, TextInput, View } from "react-native";
import { TriangleAlert, EyeOff } from "lucide-react-native";
import {
  CW_CATEGORIES,
  CW_NOTE_MAX,
  getContentWarningDecision,
} from "@kowloon/client";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { useInk } from "../../lib/useInk.js";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";

// ── Reading ─────────────────────────────────────────────────────────────────

export function useContentWarning(post) {
  const client = useActiveClient();
  const user = client?.auth?.getUser?.() || null;
  const decision = getContentWarningDecision(post, { prefs: user?.prefs, viewerId: user?.id });
  const initial = decision.mode === "hide" ? "hidden" : decision.mode === "warn" ? "warned" : "open";
  const [stage, setStage] = useState(initial);
  const [mediaShown, setMediaShown] = useState(false);

  // A different post (recycled list cell) or a changed preference starts over.
  const key = `${post?.id}|${initial}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setStage(initial);
    setMediaShown(false);
  }

  const reveal = useCallback(
    () => setStage((s) => (s === "hidden" ? "warned" : "open")),
    []
  );
  const revealMedia = useCallback(() => setMediaShown(true), []);

  return {
    decision,
    stage,
    reveal,
    mediaHidden: decision.blurMedia && !mediaShown,
    revealMedia,
  };
}

// One collapsed line in place of a post the reader chose to hide.
export function HiddenPostLine({ label, onShow, compact = false }) {
  const ink = useInk();
  return (
    <View className={`flex-row items-center bg-base-100 ${compact ? "py-1" : "px-5 py-3"}`}>
      <EyeOff size={15} color={ink(0.45)} />
      <Text className="flex-1 font-ui text-sm text-base-content/55 ml-2" numberOfLines={1}>
        {label || "Post hidden"}
      </Text>
      <Pressable onPress={onShow} hitSlop={8} className="px-2 py-1">
        <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/70">Show</Text>
      </Pressable>
    </View>
  );
}

// The bar that stands in for a warned post's title, body and media.
export function WarningBar({ decision, onShow, noun = "post" }) {
  const ink = useInk();
  return (
    <View className="border border-base-300 bg-base-200 px-4 py-3 mb-2">
      <View className="flex-row items-start">
        <TriangleAlert size={16} color={ink(0.6)} style={{ marginTop: 2 }} />
        <View className="flex-1 ml-2">
          <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55">
            Content warning
          </Text>
          <Text className="font-ui text-base text-base-content mt-0.5">{decision.label}</Text>
          {decision.byModerator ? (
            <Text className="font-ui text-xs text-base-content/50 mt-1">Added by a moderator</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onShow}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        className="self-start mt-3 px-4 py-2 bg-base-100 border border-base-300"
      >
        <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content">Show {noun}</Text>
      </Pressable>
    </View>
  );
}

// Small label above the body of a post that is shown but carries a warning
// (the reader chose Show, they opened it, or it's their own post).
export function WarningChip({ decision }) {
  const ink = useInk();
  if (!decision?.hasWarning) return null;
  return (
    <View className="flex-row items-center mb-2">
      <TriangleAlert size={12} color={ink(0.5)} />
      <Text className="font-ui text-xs text-base-content/55 ml-1.5 shrink" numberOfLines={2}>
        {decision.label}
        {decision.byModerator ? " -- added by a moderator" : ""}
      </Text>
    </View>
  );
}

// Covers photos and video marked sensitive until tapped. Children keep
// their own size; the cover sits on top of them.
export function SensitiveCover({ hidden, onReveal, children, style, className = "" }) {
  const ink = useInk();
  if (!hidden) return children;
  return (
    <View className={`relative overflow-hidden ${className}`} style={style}>
      {children}
      <Pressable
        onPress={onReveal}
        className="absolute inset-0 bg-base-300 items-center justify-center px-4"
        style={{ minHeight: 120 }}
      >
        <EyeOff size={22} color={ink(0.55)} />
        <Text className="font-ui text-sm text-base-content/70 mt-2 text-center">
          Sensitive -- tap to show
        </Text>
      </Pressable>
    </View>
  );
}

// ── Writing ─────────────────────────────────────────────────────────────────

const hasWarning = (v) => !!(v && ((v.categories && v.categories.length) || v.note));

// Toolbar icon. Tinted when a warning (or blur) is set.
export function ContentWarningButton({ value, sensitive, onPress, size = 20 }) {
  const ink = useInk();
  const active = hasWarning(value) || !!sensitive;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="p-2"
      accessibilityRole="button"
      accessibilityLabel={active ? "Content warning (set)" : "Add a content warning"}
    >
      <TriangleAlert size={size} color={active ? "#c0841a" : ink(0.6)} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * The picker. Edits a draft and hands it back on Done.
 * @param {boolean} visible
 * @param {{categories:string[], note:string}|null} value
 * @param {boolean} sensitive
 * @param {boolean} showSensitive -- offer "Blur photos" (the post has media)
 * @param {boolean} locked -- a moderator added it; the author can't change it
 * @param {(cw, sensitive) => void} onDone
 * @param {() => void} onClose
 * @param {string} [title]
 * @param {string} [doneLabel]
 * @param {boolean} [allowRemove] -- show "Remove warning" (moderator tool)
 */
export function ContentWarningSheet({
  visible,
  value,
  sensitive,
  showSensitive,
  locked = false,
  onDone,
  onClose,
  title = "Content warning",
  doneLabel = "Done",
  allowRemove = false,
  busy = false,
}) {
  const ink = useInk();
  const { keyboardInset } = useKeyboardInset();
  const [cats, setCats] = useState(value?.categories || []);
  const [note, setNote] = useState(value?.note || "");
  const [blur, setBlur] = useState(!!sensitive);

  // Start from the current value each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setCats(value?.categories || []);
      setNote(value?.note || "");
      setBlur(!!sensitive);
    }
  }, [visible]);

  const toggle = (k) => setCats((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const done = () => {
    const trimmed = note.trim().slice(0, CW_NOTE_MAX);
    const cw = cats.length || trimmed ? { categories: cats, note: trimmed } : null;
    onDone?.(cw, showSensitive ? blur : false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-6"
        style={{ paddingBottom: keyboardInset }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} className="w-full max-w-sm bg-base-100">
          <View className="px-5 py-3 bg-secondary">
            <Text className="font-ui text-lg text-secondary-content">{title}</Text>
          </View>
          {locked ? (
            <View className="p-5">
              <Text className="font-ui text-base text-base-content">
                A moderator added a content warning to this post. Only a moderator can change it.
              </Text>
              <View className="flex-row justify-end mt-5">
                <Pressable onPress={onClose} className="px-6 py-2.5 bg-primary">
                  <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">OK</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="p-5">
              <Text className="font-ui text-sm text-base-content/60 mb-3">
                Readers see the warning first and choose whether to open the post.
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {CW_CATEGORIES.map((c) => {
                  const on = cats.includes(c.key);
                  return (
                    <Pressable
                      // Remount on toggle: Android won't repaint a toggled
                      // background on a ripple Pressable in place.
                      key={`${c.key}-${on}`}
                      onPress={() => toggle(c.key)}
                      className={`px-3 py-1.5 border ${on ? "bg-primary border-primary" : "bg-base-100 border-base-300"}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Text className={`font-ui text-sm ${on ? "text-primary-content" : "text-base-content"}`}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mt-4 mb-1.5">
                Note (optional)
              </Text>
              <TextInput
                value={note}
                onChangeText={(v) => setNote(v.slice(0, CW_NOTE_MAX))}
                placeholder="e.g. spoilers for the finale"
                placeholderTextColor={ink(0.35)}
                maxLength={CW_NOTE_MAX}
                className="bg-field border border-base-300 px-3 py-2.5 font-ui text-base text-base-content"
              />
              {showSensitive ? (
                <View className="flex-row items-center justify-between mt-4">
                  <Text className="font-ui text-base text-base-content flex-1 mr-3">Blur photos and video</Text>
                  <Switch value={blur} onValueChange={setBlur} />
                </View>
              ) : null}
              <View className="flex-row items-center justify-between mt-5">
                <Pressable
                  onPress={() => {
                    if (allowRemove) {
                      onDone?.(null, false);
                    } else {
                      setCats([]);
                      setNote("");
                      setBlur(false);
                    }
                  }}
                  hitSlop={6}
                  className="px-2 py-2"
                >
                  <Text className="font-ui uppercase tracking-[0.14em] text-xs text-base-content/60">
                    {allowRemove ? "Remove warning" : "Clear"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={busy ? undefined : done}
                  android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  className={`px-6 py-2.5 bg-primary ${busy ? "opacity-60" : ""}`}
                >
                  <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
                    {doneLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Discover cards ──────────────────────────────────────────────────────────
// Discover items are compact cards (author under `actor`). A card for a post
// behind a warning shows the warning in place of its text and picture; a
// card for a post with sensitive photos drops the picture.

export function useDiscoverWarning(item) {
  const client = useActiveClient();
  const user = client?.auth?.getUser?.() || null;
  if (item?.refType && item.refType !== "Post") return { covered: false, noImage: false, label: "" };
  const d = getContentWarningDecision(
    { ...item, actorId: item?.actorId || item?.actor?.id },
    { prefs: user?.prefs, viewerId: user?.id }
  );
  return { covered: d.mode !== "show", noImage: d.mode !== "show" || d.blurMedia, label: d.label };
}

// Stand-in for a Discover card's text and picture. Fills its parent.
export function WarningTile({ label, small = false }) {
  const ink = useInk();
  return (
    <View className="flex-1 bg-base-200 p-3">
      <View className="flex-row items-center mb-1.5">
        <TriangleAlert size={small ? 11 : 13} color={ink(0.55)} />
        <Text className="font-ui uppercase tracking-[0.16em] text-[9px] text-base-content/55 ml-1.5">
          Content warning
        </Text>
      </View>
      {label ? (
        <Text
          className={`font-ui ${small ? "text-[11px]" : "text-[13px]"} text-base-content leading-snug`}
          numberOfLines={small ? 4 : 5}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
