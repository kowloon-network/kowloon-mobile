// Reply — a single reply row.
//
// Renders avatar + author + relative timestamp + body HTML. The author can
// edit (inline textarea) or delete (with confirm). A small react button sits
// at the bottom-left of the row.

import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Avatar } from "./Avatar.jsx";
import { HtmlContent } from "../HtmlContent.jsx";
import { ReactButton } from "./ReactButton.jsx";
import { timeAgo } from "../../lib/timeAgo.js";

export function Reply({
  reply,
  client,
  currentUserId,
  onUpdated,
  onDeleted,
  showReply = false,
  onReplyPress,
  replyCount = 0,
  childReplies = [],
  childComposer = null,
}) {
  const actor = reply?.actor || {};
  const html = reply?.body || reply?.source?.content || "";
  const isAuthor = !!currentUserId && reply?.actorId === currentUserId;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply?.source?.content || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await client.activities.updateReply({
        replyId: reply.id,
        content: draft,
      });
      const updated = res?.result || res?.activity?.object || null;
      onUpdated?.({
        ...reply,
        source: { ...(reply.source || {}), content: draft },
        body: updated?.body || "",
      });
      setEditing(false);
    } catch (e) {
      setError(e?.message || "Couldn't save reply.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete reply?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ],
      { cancelable: true }
    );
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await client.activities.deleteReply({ replyId: reply.id });
      onDeleted?.(reply.id);
    } catch (e) {
      setError(e?.message || "Couldn't delete reply.");
      setDeleting(false);
    }
  }

  return (
    <View>
      <View className="flex-row py-4  ">
      <View className="shrink-0 mr-3">
        <Avatar actor={actor} size={32} baseUrl={client?.http?.baseUrl} />
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center mb-1">
          <Text
            className="font-ui text-sm font-bold text-base-content"
            numberOfLines={1}
          >
            {actor?.name || actor?.id || "Someone"}
          </Text>
          <Text className="font-ui text-xs text-base-content/45 ml-2">
            {timeAgo(reply?.publishedAt || reply?.createdAt)}
          </Text>
        </View>

        {editing ? (
          <View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              placeholder="Edit your reply…"
              placeholderTextColor="rgba(26,26,32,0.35)"
              className="  bg-white px-3 py-2 font-ui text-sm text-base-content min-h-20"
            />
            <View className="flex-row justify-end mt-2">
              <Pressable
                onPress={() => {
                  setEditing(false);
                  setDraft(reply?.source?.content || "");
                  setError(null);
                }}
                hitSlop={6}
                className="px-3 py-1.5 mr-1"
              >
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/60">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!draft.trim() || saving}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className={`px-3 py-1.5 bg-primary ${
                  !draft.trim() || saving ? "opacity-40" : ""
                }`}
              >
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
                  {saving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : html ? (
          <HtmlContent html={html} fontSize={14} />
        ) : null}

        {!editing ? (
          <View className="flex-row items-center mt-2">
            {currentUserId ? (
              <View className="mr-4">
                <ReactButton client={client} post={reply} size="sm" />
              </View>
            ) : null}
            {showReply && currentUserId ? (
              <Pressable
                onPress={() => onReplyPress?.(reply)}
                hitSlop={6}
                className="mr-4"
              >
                <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/45">
                  Reply
                </Text>
              </Pressable>
            ) : null}
            {showReply && replyCount > 0 ? (
              <Text className="font-ui text-[10px] text-base-content/35 mr-4">
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </Text>
            ) : null}
            {isAuthor ? (
              <>
                <Pressable
                  onPress={() => setEditing(true)}
                  hitSlop={6}
                  className="mr-4"
                >
                  <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/45">
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  disabled={deleting}
                  hitSlop={6}
                >
                  <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-error/70">
                    {deleting ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <Text className="font-ui text-[11px] text-error mt-1">{error}</Text>
        ) : null}
      </View>
      </View>

      {/* Second-level thread — indented, capped at this depth (no reply
          affordance on children). */}
      {childReplies.length > 0 || childComposer ? (
        <View className="ml-11 pl-3 border-l border-base-content/10">
          {childReplies.map((child) => (
            <Reply
              key={child.id}
              reply={child}
              client={client}
              currentUserId={currentUserId}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          ))}
          {childComposer}
        </View>
      ) : null}
    </View>
  );
}
