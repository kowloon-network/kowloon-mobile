// AdminPostForm — create/edit a server-announcement post via the admin API.
//
// Admin-created posts are server announcements — Note or Article only.
// Link/Media/Event carry fields (href/target/attachments/event dates) the
// admin API doesn't accept yet, so they're not offered here. Reuses the same
// 10tap rich editor as PageForm; the body serializes to markdown
// (source.content) on save.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import {
  CoreBridge,
  DEFAULT_TOOLBAR_ITEMS,
  Images,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";

import { SegmentedControl } from "../ui/SegmentedControl.jsx";
import { pmToMarkdown } from "../../lib/pmToMarkdown.js";
import { useInk } from "../../lib/useInk.js";

const TOOLBAR_ITEMS = DEFAULT_TOOLBAR_ITEMS.filter(
  (item) => item.image?.() !== Images.checkList
);
const TOOLBAR_HEIGHT = 44;

const TYPE_OPTIONS = [
  { value: "Note", label: "Note" },
  { value: "Article", label: "Article" },
];

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

function PostBodyEditor({ initialHtml, editorRef, onContentChange }) {
  const editor = useEditorBridge({
    avoidIosKeyboard: true,
    initialContent: initialHtml || "",
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(`.ProseMirror { padding: 10px 16px; }`),
    ],
  });
  const text = useEditorContent(editor, { type: "text", debounceInterval: 200 });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  useEffect(() => {
    onContentChange?.(!!text?.trim());
  }, [text, onContentChange]);
  return (
    <View style={{ height: 260 }} className="bg-field border border-base-300 mt-1.5">
      <View style={{ height: TOOLBAR_HEIGHT }}>
        <Toolbar editor={editor} hidden={false} items={TOOLBAR_ITEMS} />
      </View>
      <View className="flex-1">
        <RichText editor={editor} />
      </View>
    </View>
  );
}

export function AdminPostForm({
  mode = "create",
  initialValues = {},
  serverDomain,
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) {
  const [type, setType] = useState(
    TYPE_OPTIONS.some((o) => o.value === initialValues.type) ? initialValues.type : "Note"
  );
  const [title, setTitle] = useState(initialValues.title || "");
  const [summary, setSummary] = useState(initialValues.summary || "");
  const [tags, setTags] = useState((initialValues.tags || []).join(", "));
  const [visibility, setVisibility] = useState(
    initialValues.to && initialValues.to !== "@public" ? "server" : "public"
  );
  const [imageAsset, setImageAsset] = useState(null);
  const [imageUrl, setImageUrl] = useState(initialValues.image || null);
  const [hasBody, setHasBody] = useState(!!initialValues.body?.trim());
  const editorRef = useRef(null);
  const insets = useSafeAreaInsets();
  const ink = useInk();

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImageAsset({
        uri: asset.uri,
        name: asset.fileName || `post-image-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
      setImageUrl(null);
    } catch {
      // ignore picker errors
    }
  }

  async function handleSave() {
    if (submitting) return;
    const doc = editorRef.current ? await editorRef.current.getJSON() : null;
    const markdown = (pmToMarkdown(doc) || "").trim();
    const to = visibility === "server" && serverDomain ? `@${serverDomain}` : "@public";
    onSubmit?.({
      type,
      title: type !== "Note" ? title.trim() || undefined : undefined,
      summary: summary.trim() || undefined,
      source: { content: markdown, mediaType: "text/markdown" },
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      to,
      imageAsset,
      imageUrl,
    });
  }

  const canSave = (type === "Note" ? hasBody : !!(title.trim() || hasBody)) && !submitting;

  return (
    <View className="flex-1">
      <View style={{ flex: 2 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}
        >
          <View className="mb-4">
            <FieldLabel>Type</FieldLabel>
            <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
          </View>

          {type !== "Note" ? (
            <View className="mb-4">
              <FieldLabel>Title</FieldLabel>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Post title"
                placeholderTextColor={ink(0.35)}
                className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
              />
            </View>
          ) : null}

          <View className="mb-4">
            <FieldLabel>Summary (optional)</FieldLabel>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="A short description"
              placeholderTextColor={ink(0.35)}
              className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
            />
          </View>

          <View className="mb-4">
            <FieldLabel>Featured Image</FieldLabel>
            {imageAsset?.uri || imageUrl ? (
              <View className="relative">
                <Image
                  source={{ uri: imageAsset?.uri || imageUrl }}
                  className="w-full h-40 bg-base-200"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => { setImageAsset(null); setImageUrl(null); }}
                  className="absolute top-2 right-2 bg-base-100/90 p-1"
                >
                  <X size={14} color={ink(0.85)} strokeWidth={1.75} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={pickImage}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="flex-row items-center justify-center py-6 border border-dashed border-base-300"
              >
                <ImagePlus size={16} color={ink(0.45)} strokeWidth={1.75} />
                <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/45 ml-2">
                  Upload image
                </Text>
              </Pressable>
            )}
          </View>

          <View className="mb-4">
            <FieldLabel>Tags</FieldLabel>
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="comma, separated"
              placeholderTextColor={ink(0.35)}
              autoCapitalize="none"
              className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
            />
          </View>

          <View>
            <FieldLabel>Visibility</FieldLabel>
            <SegmentedControl options={VISIBILITY_OPTIONS} value={visibility} onChange={setVisibility} />
          </View>
        </ScrollView>
      </View>

      <View style={{ flex: 3 }} className="px-5">
        <FieldLabel>Content</FieldLabel>
        <PostBodyEditor
          initialHtml={initialValues.body}
          editorRef={editorRef}
          onContentChange={setHasBody}
        />
      </View>

      {error ? (
        <Text className="font-ui text-xs text-error px-5 pt-2">{error}</Text>
      ) : null}

      <View
        className="flex-row items-center justify-end px-5 pt-3 border-t border-base-200"
        style={{ paddingBottom: insets.bottom + 12 }}
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
