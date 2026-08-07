// CopyCircleMenu — "Copy" button that opens a sheet offering:
//   - Copy as a new circle (inherits name/description/icon/visibility + members)
//   - Add this circle's members to one of your existing circles
//
// Both paths pass the source circle's full member objects to addToCircle so
// the server doesn't have to re-resolve each member.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { Copy } from "lucide-react-native";

import { useActiveClient } from "../../lib/useActiveClient.js";
import { extractCircleId } from "../../lib/circles.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";
import { useInk } from "../../lib/useInk.js";

export function CopyCircleMenu({ circle, compact = false }) {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const ink = useInk();

  const [open, setOpen] = useState(false);
  const [myCircles, setMyCircles] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadCircles = useCallback(async () => {
    if (!client || !account?.id) return;
    try {
      const res = await client.feeds.getUserCircles({ userId: account.id });
      const items = res?.orderedItems || res?.items || [];
      setMyCircles(
        items.filter((c) => c?.type !== "System" && c.id !== circle?.id)
      );
    } catch {
      // non-fatal — the "add to existing" list just stays empty
    }
  }, [client, account?.id, circle?.id]);

  useEffect(() => {
    if (open) loadCircles();
  }, [open, loadCircles]);

  const members = Array.isArray(circle?.members) ? circle.members : [];

  async function copyAsNew() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await client.activities.createCircle({
        name: circle.name,
        description: circle.summary || circle.description || undefined,
        icon: circle.icon || undefined,
        to: circle.to ?? "@public",
      });
      const newId = extractCircleId(res);
      if (newId && members.length) {
        await client.activities.addToCircle({ circleId: newId, members });
      }
      setOpen(false);
      if (newId) {
        router.push(`/circle/${encodeURIComponent(newId)}`);
      }
    } catch (e) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addMembersTo(target) {
    if (busy) return;
    if (!members.length) {
      Alert.alert("Nothing to add", "This circle has no members to copy.");
      return;
    }
    setBusy(true);
    try {
      await client.activities.addToCircle({ circleId: target.id, members });
      setOpen(false);
      Alert.alert(
        "Members added",
        `Added ${members.length} ${
          members.length === 1 ? "member" : "members"
        } to ${target.name}.`
      );
    } catch (e) {
      Alert.alert("Couldn't add members", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={compact ? 6 : undefined}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        className={`flex-row items-center   ${
          compact ? "px-2 py-1" : "px-3 py-2"
        }`}
      >
        <Copy
          size={compact ? 11 : 13}
          color={ink(0.85)}
          strokeWidth={1.75}
        />
        <Text
          className={`font-ui uppercase text-base-content ${
            compact
              ? "tracking-[0.12em] text-[10px] ml-1"
              : "tracking-[0.14em] text-[11px] ml-1.5"
          }`}
        >
          Save
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View className="flex-1 justify-end">
          <Pressable
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
            className="bg-black/40"
          />
          <SafeAreaView edges={["bottom"]} className="bg-base-100">
            <View className=" ">
              <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 px-5 pt-4 pb-2">
                Save circle
              </Text>

              <Pressable
                onPress={copyAsNew}
                disabled={busy}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className="px-5 py-3.5   flex-row items-center"
              >
                {busy ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Copy
                    size={16}
                    color={ink(0.7)}
                    strokeWidth={1.75}
                  />
                )}
                <Text className="font-ui text-base text-base-content ml-3">
                  Save as a new circle
                </Text>
              </Pressable>

              {myCircles.length > 0 ? (
                <>
                  <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/40 px-5 pt-3 pb-1">
                    Add its members to
                  </Text>
                  <ScrollView className="max-h-72">
                    {myCircles.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => addMembersTo(c)}
                        disabled={busy}
                        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                        className="px-5 py-3  "
                      >
                        <Text
                          className="font-ui text-base text-base-content"
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
