// AddToDiscoveryModal — admin-only "Add to Discovery" flow, shared across
// Post/Circle/Group. Section is resolved automatically from the item's type
// (DiscoverySections are locked one-per-contentType, so there's no picker to
// show — see DISCOVERY_CONTENT_TYPE_BY_REF_TYPE). Preview is a lightweight,
// honest summary of the item, not a literal DiscoveryCard render — the raw
// Post/Circle/Group shapes used elsewhere in the app don't line up field-for-
// field with the resolved card shape /discovery itself produces.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { DISCOVERY_CONTENT_TYPE_BY_REF_TYPE } from "@kowloon/client/admin";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { useInk } from "../../lib/useInk.js";

const NOTE_MAX = 500;

function previewOf(item, refType) {
  if (refType === "Post") {
    return {
      image: item?.featuredImage || item?.image || null,
      title: item?.title || item?.name || null,
      blurb: item?.summary || item?.textPreview || null,
    };
  }
  // Circle / Group
  return {
    image: item?.icon || item?.image || null,
    title: item?.name || null,
    blurb: item?.summary || item?.description || null,
  };
}

export function AddToDiscoveryModal({ item, refType, visible, onClose, onAdded }) {
  const client = useActiveClient();
  const ink = useInk();
  const [loadingSection, setLoadingSection] = useState(true);
  const [sectionId, setSectionId] = useState(null);
  const [sectionError, setSectionError] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !client) return;
    setNote("");
    setSectionId(null);
    setSectionError(null);
    setLoadingSection(true);
    const contentType = DISCOVERY_CONTENT_TYPE_BY_REF_TYPE[refType];
    let cancelled = false;
    client.admin
      .getSections()
      .then((res) => {
        if (cancelled) return;
        const match = (res?.sections ?? []).find(
          (s) => s.contentType === contentType && !s.deletedAt
        );
        if (!match) {
          setSectionError("No Discover section is set up for this content type yet.");
        } else {
          setSectionId(match.id);
        }
      })
      .catch((e) => {
        if (!cancelled) setSectionError(e?.message || "Failed to load Discover sections");
      })
      .finally(() => {
        if (!cancelled) setLoadingSection(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, refType, client]);

  const preview = previewOf(item, refType);

  async function handleAdd() {
    if (!sectionId || submitting) return;
    setSubmitting(true);
    try {
      await client.admin.addDiscoveryItem({
        ref: item.id,
        section: sectionId,
        note: note.trim() || undefined,
      });
      onAdded?.();
      onClose();
      Alert.alert("Added to Discovery");
    } catch (e) {
      Alert.alert("Couldn't add to Discovery", e?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ maxHeight: "80%" }} className="bg-base-100">
          <View className="px-5 pt-4 pb-3">
            <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/45 mb-1.5">
              Add to Discovery
            </Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            <View className="px-5 flex-row items-center mb-4">
              {preview.image ? (
                <Image
                  source={{ uri: preview.image }}
                  style={{ width: 56, height: 56 }}
                  className="bg-base-300"
                />
              ) : (
                <View style={{ width: 56, height: 56 }} className="bg-base-300" />
              )}
              <View className="ml-3 flex-1 min-w-0">
                <Text className="font-ui text-[10px] uppercase tracking-widest text-base-content/50">
                  {refType}
                </Text>
                <Text className="font-ui text-sm font-bold text-base-content" numberOfLines={1}>
                  {preview.title || "Untitled"}
                </Text>
                {preview.blurb ? (
                  <Text className="font-ui text-xs text-base-content/60" numberOfLines={1}>
                    {preview.blurb}
                  </Text>
                ) : null}
              </View>
            </View>

            {loadingSection ? (
              <View className="py-6 items-center">
                <ActivityIndicator />
              </View>
            ) : sectionError ? (
              <Text className="font-ui text-sm text-error px-5 pb-4">{sectionError}</Text>
            ) : (
              <View className="px-5 pb-4">
                <Text className="font-ui text-xs uppercase tracking-widest text-base-content/60 mb-1.5">
                  Commentary (optional)
                </Text>
                <TextInput
                  value={note}
                  onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
                  maxLength={NOTE_MAX}
                  multiline
                  numberOfLines={3}
                  placeholder="Why this is worth featuring…"
                  placeholderTextColor={ink(0.35)}
                  className="font-ui text-sm text-base-content border border-base-300 p-2.5"
                  style={{ minHeight: 72, textAlignVertical: "top" }}
                />
                <Text className="font-ui text-[10px] text-base-content/40 text-right mt-1">
                  {note.length}/{NOTE_MAX}
                </Text>
              </View>
            )}
          </ScrollView>

          <View className="flex-row border-t border-base-200">
            <Pressable
              onPress={onClose}
              className="flex-1 py-4 items-center"
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            >
              <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              disabled={submitting || !sectionId}
              className="flex-1 py-4 items-center bg-primary"
              style={{ opacity: submitting || !sectionId ? 0.4 : 1 }}
              android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            >
              <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-primary-content">
                {submitting ? "Adding…" : "Add"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
