// ReactorsModal — who reacted to a post, and with what (#63, same feature as
// web's PostReacts.jsx). Fetched on demand via client.feeds.getReacts(), not
// pre-loaded with the post.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { X } from "lucide-react-native";

import { Avatar } from "./Avatar.jsx";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";

export function ReactorsModal({ visible, postId, onClose }) {
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const router = useRouter();
  const [reacts, setReacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!client || !postId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.feeds.getReacts({ postId });
      setReacts(res?.orderedItems ?? res?.items ?? []);
    } catch (e) {
      setError(e?.message || "Couldn't load reactions.");
    } finally {
      setLoading(false);
    }
  }, [client, postId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <SafeAreaView edges={["bottom"]} className="bg-base-100 max-h-[70%]">
          <View className="flex-row items-center justify-between px-5 py-4 border-b-2 border-base-300 bg-secondary">
            <Text className="font-display text-lg text-secondary-content tracking-wide">
              Reactions
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color="white" />
            </Pressable>
          </View>
          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator />
            </View>
          ) : error ? (
            <Text className="py-10 text-center font-ui text-sm text-error">{error}</Text>
          ) : reacts.length === 0 ? (
            <Text className="py-10 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">
              No reactions yet.
            </Text>
          ) : (
            <ScrollView>
              {reacts.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    onClose();
                    router.push(`/user/${encodeURIComponent(r.actorId)}`);
                  }}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  className="flex-row items-center px-5 py-3 border-b border-base-300"
                >
                  <Avatar actor={r.actor ?? { id: r.actorId }} size={32} baseUrl={account?.baseUrl} />
                  <Text className="flex-1 font-ui text-sm text-base-content ml-3" numberOfLines={1}>
                    {r.actor?.name ?? r.actor?.username ?? r.actorId}
                  </Text>
                  <Text style={{ fontSize: 18, lineHeight: 22 }}>{r.emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
