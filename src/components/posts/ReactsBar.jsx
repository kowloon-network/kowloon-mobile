// ReactsBar — a summary of a post's reactions, grouped by emoji with counts
// (e.g. "👍 5   ❤️ 2   🤬 12"). Shown on the post detail. Adding/changing your
// own reaction is handled by the ReactButton, not here. Tapping any emoji
// opens ReactorsModal, listing who reacted and with what (#63).

import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ReactorsModal } from "./ReactorsModal.jsx";

export function ReactsBar({ reactCounts, postId }) {
  const [modalOpen, setModalOpen] = useState(false);
  if (!Array.isArray(reactCounts) || reactCounts.length === 0) return null;
  return (
    <>
      <View
        className="flex-row flex-wrap items-center px-5 py-3"
        style={{ gap: 16 }}
      >
        {reactCounts.map(({ emoji, count }) => (
          <Pressable
            key={emoji}
            onPress={() => setModalOpen(true)}
            className="flex-row items-center"
            hitSlop={6}
          >
            <Text style={{ fontSize: 16, lineHeight: 20 }}>{emoji}</Text>
            <Text className="font-ui text-sm text-base-content/70 ml-1.5">
              {count}
            </Text>
          </Pressable>
        ))}
      </View>
      <ReactorsModal
        visible={modalOpen}
        postId={postId}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
