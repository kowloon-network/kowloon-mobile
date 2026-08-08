// MorePostsByAuthor (#32) — at the bottom of a single post page, feature a couple
// more public posts by the same author, rendered with the full feed PostCard.
// "More Posts By {name}". Renders nothing if there are none.
import { useEffect, useState } from "react";
import { View, Text } from "react-native";

import { PostCard } from "./PostCard.jsx";
import { useActiveClient } from "../../lib/useActiveClient.js";

const COUNT = 2;

export function MorePostsByAuthor({ post }) {
  const client = useActiveClient();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!client || !post?.actorId) return;
    let cancelled = false;
    client.feeds
      .getUserPosts({ userId: post.actorId, sort: "top" })
      .then((res) => {
        if (cancelled) return;
        const all = res?.orderedItems || res?.items || [];
        setItems(all.filter((p) => p.id !== post.id).slice(0, COUNT));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, post?.actorId, post?.id]);

  if (items.length === 0) return null;

  const name = post.actor?.name || post.actor?.id || "this author";

  return (
    <View className="pt-6 mt-4 border-t border-base-300">
      <Text className="px-5 font-ui text-lg font-bold text-base-content mb-1">
        More Posts By {name}
      </Text>
      {items.map((p) => (
        <View key={p.id} className="border-t border-base-300">
          <PostCard post={p} />
        </View>
      ))}
    </View>
  );
}
