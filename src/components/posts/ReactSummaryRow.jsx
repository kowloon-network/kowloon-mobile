// ReactSummaryRow — read-only reaction summary for feed cards (#79): the
// distinct emojis a post has received (server-sorted by count desc, joined) plus
// the total, e.g. "❤️😂🤮 23". Sits between the post body and the action bar.
// The full post detail view keeps the per-emoji ReactsBar instead.

import { Text, View } from "react-native";

export function ReactSummaryRow({ post }) {
  const summary = (post?.reactSummary || "").trim();
  const total = post?.reactCount ?? 0;
  if (!summary || total <= 0) return null;
  return (
    <View className="flex-row items-center mt-2.5" style={{ gap: 6 }}>
      <Text style={{ fontSize: 15, lineHeight: 20 }}>{summary}</Text>
      <Text className="font-ui text-sm text-base-content/60">{total}</Text>
    </View>
  );
}
