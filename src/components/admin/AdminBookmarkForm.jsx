// AdminBookmarkForm — create/edit a server-owned bookmark or folder.
//
// Visibility is Public/Server only (no circle scoping — this is a
// server-owned bookmark, same restriction as AdminGroupForm). Folder
// nesting is capped at one level: a Folder can't have a parentFolder, so
// the folder picker only appears for type === "Bookmark".

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

import { SegmentedControl } from "../ui/SegmentedControl.jsx";
import { BottomSheetPicker } from "../ui/BottomSheetPicker.jsx";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { useInk } from "../../lib/useInk.js";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "server", label: "Server" },
];

const TYPE_OPTIONS = [
  { value: "Bookmark", label: "Bookmark" },
  { value: "Folder", label: "Folder" },
];

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

export function AdminBookmarkForm({
  mode = "create",
  initialValues = {},
  serverDomain,
  folders = [],
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) {
  const { keyboardInset } = useKeyboardInset();
  const insets = useSafeAreaInsets();
  const ink = useInk();

  const [title, setTitle] = useState(initialValues.title || "");
  const [type, setType] = useState(initialValues.type || "Bookmark");
  const [href, setHref] = useState(initialValues.href || "");
  const [parentFolder, setParentFolder] = useState(initialValues.parentFolder || null);
  const [visibility, setVisibility] = useState(
    initialValues.to && initialValues.to !== "@public" ? "server" : "public"
  );

  const folderOptions = [
    { value: null, label: "None (top level)" },
    ...folders.map((f) => ({ value: f.id, label: f.title })),
  ];

  function handleSave() {
    if (submitting) return;
    const to = visibility === "server" && serverDomain ? `@${serverDomain}` : "@public";
    onSubmit?.({
      title: title.trim(),
      type,
      href: type === "Bookmark" ? href.trim() : undefined,
      parentFolder: type === "Bookmark" ? parentFolder || undefined : undefined,
      to,
    });
  }

  const canSave =
    !!title.trim() && (type === "Folder" || !!href.trim()) && !submitting;

  return (
    <View className="flex-1">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 20 + keyboardInset }}
      >
        <View className="mb-5">
          <FieldLabel>Title</FieldLabel>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Bookmark title"
            placeholderTextColor={ink(0.35)}
            className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
          />
        </View>

        <View className="mb-5">
          <FieldLabel>Type</FieldLabel>
          <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
        </View>

        {type === "Bookmark" ? (
          <>
            <View className="mb-5">
              <FieldLabel>URL</FieldLabel>
              <TextInput
                value={href}
                onChangeText={setHref}
                placeholder="https://…"
                placeholderTextColor={ink(0.35)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
              />
            </View>

            <View className="mb-5">
              <FieldLabel>Folder</FieldLabel>
              <BottomSheetPicker
                label="Folder"
                value={parentFolder}
                options={folderOptions}
                onChange={setParentFolder}
                title="Place in folder"
              />
            </View>
          </>
        ) : null}

        <View>
          <FieldLabel>Visibility</FieldLabel>
          <SegmentedControl options={VISIBILITY_OPTIONS} value={visibility} onChange={setVisibility} />
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
