// PageForm — create/edit a server Page. Reuses the same 10tap rich editor as the
// post composer; the body is serialized to markdown (source.content) on save,
// exactly how the server stores and re-renders Page content.
//
// v1 fields: title, slug (auto from title, editable), summary, visibility, body.
// Folder/nav-ordering is a later addition.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CoreBridge,
  DEFAULT_TOOLBAR_ITEMS,
  Images,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
} from "@10play/tentap-editor";

import { pmToMarkdown } from "../../lib/pmToMarkdown.js";
import { useInk } from "../../lib/useInk.js";

const TOOLBAR_ITEMS = DEFAULT_TOOLBAR_ITEMS.filter(
  (item) => item.image?.() !== Images.checkList
);
const TOOLBAR_HEIGHT = 44;

const inputCls =
  "bg-white border border-base-300 px-3 py-2.5 font-ui text-base text-base-content";

function slugify(str = "") {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

// The editor is created WITH the body as initialContent (creating empty then
// calling setContent drops the content — see app/post/[id]/edit.js). It hands
// its instance up via editorRef so the form can serialize it on save.
function PageBodyEditor({ initialHtml, editorRef }) {
  const editor = useEditorBridge({
    avoidIosKeyboard: true,
    initialContent: initialHtml || "",
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(`.ProseMirror { padding: 10px 16px; }`),
    ],
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return (
    <View className="flex-1 bg-white border border-base-300 mt-1.5">
      <View style={{ height: TOOLBAR_HEIGHT }}>
        <Toolbar editor={editor} hidden={false} items={TOOLBAR_ITEMS} />
      </View>
      <View className="flex-1">
        <RichText editor={editor} />
      </View>
    </View>
  );
}

export function PageForm({
  mode = "create",
  initialValues = {},
  serverDomain,
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) {
  const [title, setTitle] = useState(initialValues.title || "");
  const [slug, setSlug] = useState(initialValues.slug || slugify(initialValues.title || ""));
  const [summary, setSummary] = useState(initialValues.summary || "");
  const [visibility, setVisibility] = useState(
    initialValues.to && initialValues.to !== "@public" ? "server" : "public"
  );
  const slugTouched = useRef(!!initialValues.slug);
  const editorRef = useRef(null);
  const insets = useSafeAreaInsets();
  const ink = useInk();

  function onTitleChange(v) {
    setTitle(v);
    if (!slugTouched.current) setSlug(slugify(v));
  }

  async function handleSave() {
    if (submitting) return;
    const doc = editorRef.current ? await editorRef.current.getJSON() : null;
    const markdown = (pmToMarkdown(doc) || "").trim();
    const to = visibility === "server" && serverDomain ? `@${serverDomain}` : "@public";
    onSubmit?.({
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      summary: summary.trim() || undefined,
      to,
      source: { content: markdown, mediaType: "text/markdown" },
    });
  }

  const canSave = !!title.trim() && !submitting;

  return (
    <View className="flex-1">
      {/* Metadata — its own scroll region so every field is reachable even with
          the keyboard up. */}
      <View style={{ flex: 2 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}
        >
          <View className="mb-4">
            <FieldLabel>Title</FieldLabel>
            <TextInput
              value={title}
              onChangeText={onTitleChange}
              placeholder="Page title"
              placeholderTextColor={ink(0.35)}
              className={inputCls}
            />
          </View>

          <View className="mb-4">
            <FieldLabel>Slug</FieldLabel>
            <TextInput
              value={slug}
              onChangeText={(v) => {
                slugTouched.current = true;
                setSlug(v);
              }}
              placeholder="page-url-slug"
              placeholderTextColor={ink(0.35)}
              autoCapitalize="none"
              autoCorrect={false}
              className={inputCls}
            />
          </View>

          <View className="mb-4">
            <FieldLabel>Summary (optional)</FieldLabel>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="A short description"
              placeholderTextColor={ink(0.35)}
              className={inputCls}
            />
          </View>

          <View>
            <FieldLabel>Visibility</FieldLabel>
            <View className="flex-row">
              {[
                { key: "public", label: "Public" },
                { key: "server", label: "Server" },
              ].map((o) => {
                const active = visibility === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setVisibility(o.key)}
                    className={`flex-1 items-center py-2.5 border ${
                      active ? "bg-primary border-primary" : "border-base-300"
                    }`}
                    android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  >
                    <Text
                      className={`font-ui uppercase tracking-[0.12em] text-[11px] ${
                        active ? "text-primary-content" : "text-base-content/60"
                      }`}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Content — the editor fills the remaining space, with its own internal
          scroll; shrinks above the keyboard when focused. */}
      <View style={{ flex: 3 }} className="px-5">
        <FieldLabel>Content</FieldLabel>
        <PageBodyEditor initialHtml={initialValues.body} editorRef={editorRef} />
      </View>

      {error ? (
        <Text className="font-ui text-xs text-error px-5 pt-2">{error}</Text>
      ) : null}

      {/* Footer clears the Android nav bar / home indicator. */}
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
