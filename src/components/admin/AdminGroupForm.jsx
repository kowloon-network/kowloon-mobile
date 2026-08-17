// AdminGroupForm — create/edit a server-owned group via the admin API.
//
// Simpler than the user-facing GroupForm: visibility is just Public/Server
// (no circle-scoping — this is a server-owned group), and no banner image
// (the admin route doesn't accept one).

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus } from "lucide-react-native";

import { GroupAvatar } from "../groups/GroupAvatar.jsx";
import { SegmentedControl } from "../ui/SegmentedControl.jsx";
import { BottomSheetPicker } from "../ui/BottomSheetPicker.jsx";
import { RSVP_POLICIES } from "../../lib/groups.js";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { useInk } from "../../lib/useInk.js";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "server", label: "Server" },
];

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

export function AdminGroupForm({
  mode = "create",
  initialValues = {},
  serverDomain,
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) {
  const { keyboardInset } = useKeyboardInset();
  const insets = useSafeAreaInsets();
  const ink = useInk();

  const [name, setName] = useState(initialValues.name || "");
  const [description, setDescription] = useState(initialValues.description || "");
  const [visibility, setVisibility] = useState(
    initialValues.to && initialValues.to !== "@public" ? "server" : "public"
  );
  const [rsvpPolicy, setRsvpPolicy] = useState(initialValues.rsvpPolicy || "open");
  const [iconAsset, setIconAsset] = useState(null);
  const [iconUrl, setIconUrl] = useState(initialValues.icon || null);

  async function pickIcon() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setIconAsset({
        uri: asset.uri,
        name: asset.fileName || `group-icon-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
      setIconUrl(null);
    } catch {
      // ignore picker errors
    }
  }

  function handleSave() {
    if (submitting) return;
    const to = visibility === "server" && serverDomain ? `@${serverDomain}` : "@public";
    onSubmit?.({
      name: name.trim(),
      description: description.trim() || undefined,
      rsvpPolicy,
      to,
      iconAsset,
      iconUrl,
    });
  }

  const canSave = !!name.trim() && !submitting;
  const previewGroup = { icon: iconAsset?.uri || iconUrl, name };

  return (
    <View className="flex-1">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 20 + keyboardInset }}
      >
        <View className="flex-row items-center mb-5">
          <Pressable onPress={pickIcon} className="relative">
            <GroupAvatar group={previewGroup} size={64} />
            <View className="absolute -bottom-1 -right-1 bg-base-100 p-1">
              <ImagePlus size={13} color={ink(0.85)} strokeWidth={1.75} />
            </View>
          </Pressable>
          <View className="flex-1 ml-4">
            <FieldLabel>Name</FieldLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Group name"
              placeholderTextColor={ink(0.35)}
              className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
            />
          </View>
        </View>

        <View className="mb-5">
          <FieldLabel>Description</FieldLabel>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="What's this group for?"
            placeholderTextColor={ink(0.35)}
            className="bg-field px-3 py-2.5 font-ui text-base text-base-content min-h-20"
          />
        </View>

        <View className="mb-5">
          <FieldLabel>Visibility</FieldLabel>
          <SegmentedControl options={VISIBILITY_OPTIONS} value={visibility} onChange={setVisibility} />
        </View>

        <View>
          <FieldLabel>Joining</FieldLabel>
          <BottomSheetPicker
            label="Policy"
            value={rsvpPolicy}
            options={RSVP_POLICIES}
            onChange={setRsvpPolicy}
            title="How people join"
          />
          <Text className="font-ui text-xs text-base-content/55 mt-1.5">
            {RSVP_POLICIES.find((o) => o.value === rsvpPolicy)?.summary || ""}
          </Text>
        </View>

        {error ? (
          <Text className="font-ui text-xs text-error mt-4">{error}</Text>
        ) : null}
      </ScrollView>

      <View
        className="flex-row items-center justify-end px-5 pt-3 border-t border-base-200"
        style={{ paddingBottom: (keyboardInset > 0 ? 0 : insets.bottom) + 12 }}
      >
        <Pressable onPress={onCancel} hitSlop={6} className="px-4 py-2.5 mr-2">
          <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          className={`px-5 py-2.5 bg-primary ${canSave ? "" : "opacity-40"}`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FAF4E8" />
          ) : (
            <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
              {mode === "edit" ? "Save" : "Create"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
