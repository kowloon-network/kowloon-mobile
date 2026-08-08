// ReplyComposer — textarea + send for posting a reply.
//
// Posts via client.activities.reply() with a per-attempt dedupeKey (so a
// network blip retry doesn't create two reply Activities on the server). The
// key is regenerated whenever the text changes.

import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Avatar } from "./Avatar.jsx";
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
}) {
  const ink = useInk();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const dedupeRef = useRef(null);
  const inputRef = useRef(null);

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
        dedupeKey: dedupeRef.current.key,
      });
      setText("");
      dedupeRef.current = null;
      onSubmitted?.({
        duplicated: !!res?.duplicated,
        result: res,
        content: text,
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
    </View>
  );
}
