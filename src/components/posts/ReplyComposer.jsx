// ReplyComposer — textarea + send for posting a reply.
//
// Posts via client.activities.reply() with a per-attempt dedupeKey (so a
// network blip retry doesn't create two reply Activities on the server). The
// key is regenerated whenever the text changes.

import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { inheritedContentWarning, contentWarningLabel } from "@kowloon/client";
import { Avatar } from "./Avatar.jsx";
import { ContentWarningButton, ContentWarningSheet } from "./ContentWarning.jsx";
import { useInk } from "../../lib/useInk.js";

export function ReplyComposer({
  postId,
  inReplyTo,
  client,
  currentUser,
  canReply,
  onSubmitted,
  autoFocus = false,
  placeholder = "Write a reply…",
  // The post or reply being answered: a reply starts with its content
  // warning, which the author can change or clear.
  parent = null,
}) {
  const ink = useInk();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const dedupeRef = useRef(null);
  const inputRef = useRef(null);
  const inherited = inheritedContentWarning(parent);
  const [cw, setCw] = useState(inherited);
  const [cwOpen, setCwOpen] = useState(false);
  // The parent loads after the composer mounts on some screens.
  const inheritedKey = JSON.stringify(inherited);
  const [lastInherited, setLastInherited] = useState(inheritedKey);
  if (inheritedKey !== lastInherited) {
    setLastInherited(inheritedKey);
    setCw(inherited);
  }

  // Imperative focus — autoFocus on first render isn't enough on Android,
  // where the input lives off-screen until the parent ScrollView lays out.
  // Delay one tick so layout completes, then focus to raise the keyboard.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [autoFocus]);

  if (!currentUser) return null;

  if (canReply === "@none") {
    return (
      <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/45 py-4">
        Replies are closed for this post.
      </Text>
    );
  }

  async function submit() {
    if (!text.trim() || submitting) return;
    if (!dedupeRef.current || dedupeRef.current.text !== text) {
      const key =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      dedupeRef.current = { key, text };
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await client.activities.reply({
        postId,
        ...(inReplyTo ? { inReplyTo } : {}),
        content: text,
        ...(cw ? { contentWarning: cw } : {}),
        dedupeKey: dedupeRef.current.key,
      });
      setText("");
      dedupeRef.current = null;
      const sentCw = cw;
      setCw(inheritedContentWarning(parent));
      onSubmitted?.({
        duplicated: !!res?.duplicated,
        result: res,
        content: text,
        contentWarning: sentCw,
        inReplyTo,
      });
    } catch (e) {
      setError(e?.message || "Couldn't post reply.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-row pt-4">
      <View className="shrink-0 mr-3">
        <Avatar actor={currentUser} size={32} baseUrl={client?.http?.baseUrl} />
      </View>
      <View className="flex-1 min-w-0">
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          multiline
          placeholder={placeholder}
          placeholderTextColor={ink(0.35)}
          className="  bg-field px-3 py-2.5 font-ui text-[15px] text-base-content min-h-20"
        />
        <View className="flex-row items-center justify-end mt-2">
          <View className="flex-row items-center mr-auto flex-1 min-w-0">
            <ContentWarningButton value={cw} onPress={() => setCwOpen(true)} size={18} />
            {cw ? (
              <Text className="font-ui text-xs text-base-content/55 shrink" numberOfLines={1}>
                {contentWarningLabel({ contentWarning: cw })}
              </Text>
            ) : null}
          </View>
          {error ? (
            <Text className="font-ui text-[11px] text-error mr-3 flex-1">
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={submit}
            disabled={!text.trim() || submitting}
            android_ripple={{ color: "rgba(0,0,0,0.08)" }}
            className={`px-4 py-2 bg-primary ${
              !text.trim() || submitting ? "opacity-40" : ""
            }`}
          >
            <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
              {submitting ? "Replying…" : "Reply"}
            </Text>
          </Pressable>
        </View>
      </View>
      {cwOpen ? (
        <ContentWarningSheet
          visible
          value={cw}
          onClose={() => setCwOpen(false)}
          onDone={(next) => {
            setCw(next);
            setCwOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
