// ProfileActions — the relationship actions for someone else's profile:
// Add to Circle (the Kowloon "follow"), plus Block and Mute in an overflow menu.
//
// Kowloon has no follow/unfollow — adding a person to one of your circles IS
// the follow (see [[feedback-no-follow-notifications]]: the target is never
// notified). Block/Mute post the matching outbox activities. Rendered only for
// non-self profiles; the parent decides that.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ban, BellOff, Check, MoreHorizontal, X } from "lucide-react-native";
import { sortByPins } from "@kowloon/client";

import { useInk } from "../../lib/useInk.js";

export function ProfileActions({ client, account, targetId, name }) {
  const ink = useInk();
  const displayName = name || targetId || "this user";

  // --- Add to Circle picker --------------------------------------------------
  const [showPicker, setShowPicker] = useState(false);
  const [circles, setCircles] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [addedTo, setAddedTo] = useState(() => new Set());
  const [circleQuery, setCircleQuery] = useState("");

  const filteredCircles = useMemo(() => {
    const q = circleQuery.trim().toLowerCase();
    return q ? circles.filter((c) => c.name?.toLowerCase().includes(q)) : circles;
  }, [circles, circleQuery]);

  const openPicker = useCallback(async () => {
    if (!client || !account?.id) return;
    setShowPicker(true);
    if (circles.length > 0) return;
    setPickerLoading(true);
    try {
      // `contains` asks the server which of these circles already hold this
      // person, so the ✓ reflects real membership instead of resetting each
      // time the picker opens.
      const res = await client.feeds.getUserCircles({
        userId: account.id,
        contains: targetId,
        limit: 100,
      });
      // Only user-created circles are valid add targets (not System circles);
      // ordered by the user's feed-selector pins so this list matches everywhere.
      const list = (res?.orderedItems ?? res?.items ?? []).filter(
        (c) => c?.id && c?.name && c?.type !== "System"
      );
      const pinned = client?.auth?.getUser?.()?.prefs?.pinnedCircles || [];
      setCircles(sortByPins(list, pinned));
      const already = list.filter((c) => c.contains).map((c) => c.id);
      if (already.length) setAddedTo((prev) => new Set([...prev, ...already]));
    } catch {
      // fail silently — show the empty state in the modal
    } finally {
      setPickerLoading(false);
    }
  }, [client, account?.id, circles.length, targetId]);

  const addToCircle = useCallback(
    async (circleId) => {
      if (!client || addingTo) return;
      setAddingTo(circleId);
      try {
        await client.activities.addToCircle({ circleId, memberId: targetId });
        setAddedTo((prev) => new Set([...prev, circleId]));
      } catch (e) {
        Alert.alert("Couldn't add", e?.message || "Please try again.");
      } finally {
        setAddingTo(null);
      }
    },
    [client, targetId, addingTo]
  );

  // --- Overflow menu (Block / Mute) ------------------------------------------
  const triggerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  function openMenu() {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      setMenuPos({ top: y + h + 4, left: Math.max(8, x + w - 200) });
      setMenuOpen(true);
    });
  }

  function confirmBlock() {
    setMenuOpen(false);
    Alert.alert(
      `Block ${displayName}?`,
      "They won't be able to interact with you and their posts won't appear in your feed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await client.activities.block({ userId: targetId });
              Alert.alert("Blocked", `${displayName} has been blocked.`);
            } catch (e) {
              Alert.alert("Couldn't block", e?.message || "Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  function confirmMute() {
    setMenuOpen(false);
    Alert.alert(
      `Mute ${displayName}?`,
      "Their posts won't appear in your feed. You can undo this from your settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "destructive",
          onPress: async () => {
            try {
              await client.activities.mute({ userId: targetId });
              Alert.alert("Muted", `${displayName} has been muted.`);
            } catch (e) {
              Alert.alert("Couldn't mute", e?.message || "Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  return (
    <View className="flex-row items-center px-5 pb-4" style={{ gap: 8 }}>
      <Pressable
        onPress={openPicker}
        android_ripple={{ color: "rgba(255,255,255,0.15)" }}
        className="flex-1 bg-primary py-2.5 items-center"
      >
        <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
          Add to Circle
        </Text>
      </Pressable>

      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        className="bg-base-200 px-4 py-2.5 items-center justify-center"
        accessibilityLabel="More options"
      >
        <MoreHorizontal size={18} color={ink(0.7)} strokeWidth={2} />
      </Pressable>

      {/* Overflow menu — anchored below the trigger. */}
      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1" onPress={() => setMenuOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={{ position: "absolute", top: menuPos.top, left: menuPos.left, width: 200 }}
            className="bg-base-100"
          >
            <Pressable
              onPress={confirmMute}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="flex-row items-center px-4 py-3"
            >
              <BellOff size={15} color={ink(0.85)} strokeWidth={1.75} />
              <Text className="font-ui text-sm ml-3 text-base-content">Mute</Text>
            </Pressable>
            <Pressable
              onPress={confirmBlock}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="flex-row items-center px-4 py-3"
            >
              <Ban size={15} color="#CC272E" strokeWidth={1.75} />
              <Text className="font-ui text-sm ml-3 text-error">Block</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add-to-Circle picker — full-screen modal (a slide-up sheet clipped its
          last row under Android's nav bar) with a search box at the top. */}
      <Modal
        visible={showPicker}
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <SafeAreaView className="flex-1 bg-base-100" edges={["top", "bottom"]}>
          <View className="flex-row items-center justify-between px-5 py-4">
            <Text
              className="font-ui text-lg text-base-content flex-1 mr-3"
              numberOfLines={1}
            >
              Add {displayName} to Circle
            </Text>
            <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
              <X size={20} color={ink(0.7)} strokeWidth={2} />
            </Pressable>
          </View>

          <View className="px-5 pb-3">
            <TextInput
              value={circleQuery}
              onChangeText={setCircleQuery}
              placeholder="Search your circles..."
              placeholderTextColor={ink(0.35)}
              autoCorrect={false}
              autoCapitalize="none"
              className="bg-base-200 px-3 py-2.5 font-ui text-base text-base-content"
            />
          </View>

          {pickerLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator />
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" className="flex-1">
              {filteredCircles.length === 0 ? (
                <View className="px-6 py-10 items-center">
                  <Text className="font-ui text-base text-base-content/55 text-center">
                    {circles.length === 0
                      ? "No circles yet. Create one first."
                      : "No circles match."}
                  </Text>
                </View>
              ) : (
                filteredCircles.map((circle) => {
                  const isAdded = addedTo.has(circle.id);
                  const isAdding = addingTo === circle.id;
                  return (
                    <Pressable
                      key={circle.id}
                      onPress={() => !isAdded && addToCircle(circle.id)}
                      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                      className="flex-row items-center justify-between px-5 py-4"
                    >
                      <View className="flex-1 min-w-0 mr-3">
                        <Text
                          className={`font-ui text-base leading-tight ${
                            isAdded ? "text-base-content/50" : "text-base-content"
                          }`}
                          numberOfLines={1}
                        >
                          {circle.name}
                        </Text>
                        {typeof circle.memberCount === "number" ? (
                          <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/40 mt-0.5">
                            {circle.memberCount.toLocaleString()} members
                          </Text>
                        ) : null}
                      </View>
                      {isAdding ? (
                        <ActivityIndicator size="small" />
                      ) : isAdded ? (
                        <Check size={16} color={ink(0.5)} strokeWidth={2.5} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
