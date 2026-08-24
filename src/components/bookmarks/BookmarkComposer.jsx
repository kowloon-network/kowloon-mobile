// BookmarkComposer — modal form for saving a bookmark.
//
// Triggered from the post action bar (prefilled with the post's URL/title/
// image) and usable standalone for an arbitrary URL. Fields: URL, title
// (auto-fetched from OG metadata), featured image preview, notes, tags,
// folder, and audience. Posts via client.activities.createBookmark with a
// per-attempt dedupeKey so a retry can't duplicate.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FolderPlus, X } from "lucide-react-native";

import { AudienceSelector } from "../posts/AudienceSelector.jsx";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";
import { useInk } from "../../lib/useInk.js";

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

export function BookmarkComposer({
  visible,
  onClose,
  initialValues = {},
  client,
  currentUser,
  onSaved,
}) {
  const baseUrl = client?.http?.baseUrl;
  const { keyboardInset } = useKeyboardInset();
  const ink = useInk();

  const [href, setHref] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [image, setImage] = useState(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [audience, setAudience] = useState("@public");
  const [parentFolder, setParentFolder] = useState(null);
  const [folders, setFolders] = useState([]);

  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const dedupeRef = useRef(null);
  const hrefLocked = !!initialValues.href;
  // URL already auto-filled from, so a re-fetch (as the user keeps typing)
  // never re-injects title/summary/image the user has since edited or
  // cleared. Reset whenever the sheet re-opens (see hydration effect below).
  const autoFilledHrefRef = useRef(null);

  // Hydrate from initialValues each time the sheet opens; reset on close.
  useEffect(() => {
    if (!visible) return;
    setHref(initialValues.href || "");
    setTitle(initialValues.title || "");
    setSummary(initialValues.summary || "");
    setImage(initialValues.image || null);
    setNotes(initialValues.notes || "");
    setTags("");
    setAudience("@public");
    setParentFolder(null);
    setError(null);
    setShowNewFolder(false);
    setNewFolderName("");
    dedupeRef.current = null;
    autoFilledHrefRef.current = null;
    // initialValues is recreated each render by the caller; key off `visible`
    // so we only re-hydrate on an open transition, not every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Live link preview — debounced as the URL is typed/pasted, matching the
  // Link-type post composer's autofill (app/compose.js). Fills title/summary/
  // image once per URL, only into fields that are still empty. Also covers
  // the "opened with a prefilled URL but no title" case (share-intent flow),
  // since href is set from initialValues by the hydration effect above.
  useEffect(() => {
    if (!visible || !href.trim() || !client) return;
    const url = href.trim();
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        new URL(url);
      } catch {
        return;
      }
      setFetchingPreview(true);
      try {
        const meta = await client.feeds.getLinkPreview({ url });
        if (cancelled) return;
        if (meta && autoFilledHrefRef.current !== url) {
          autoFilledHrefRef.current = url;
          if (meta.title && !title) setTitle(meta.title);
          if (meta.summary && !summary) setSummary(meta.summary);
          if (meta.image && !image) setImage(meta.image);
        }
      } catch {
        /* non-fatal — preview is enhancement-only */
      } finally {
        if (!cancelled) setFetchingPreview(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, visible, client]);

  // Load the user's folders for the picker.
  useEffect(() => {
    if (!visible || !client || !currentUser?.id) return;
    let cancelled = false;
    client.feeds
      .getUserBookmarks({ userId: currentUser.id, type: "Folder" })
      .then((res) => {
        if (cancelled) return;
        const all = res?.orderedItems || res?.items || [];
        setFolders(all.filter((f) => f?.id && f?.title));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, client, currentUser?.id]);

  async function handleSave() {
    if (!href.trim() || !title.trim() || saving) return;
    const tagList = tags
      ? tags.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const signature = JSON.stringify({
      href: href.trim(),
      title: title.trim(),
      summary: summary.trim(),
      notes,
      tagList,
      audience,
      parentFolder,
    });
    if (!dedupeRef.current || dedupeRef.current.signature !== signature) {
      const key =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      dedupeRef.current = { key, signature };
    }
    setSaving(true);
    setError(null);
    try {
      const res = await client.activities.createBookmark({
        href: href.trim(),
        title: title.trim(),
        summary: summary.trim() || undefined,
        image: image || undefined,
        body: notes.trim() || undefined,
        tags: tagList.length ? tagList : undefined,
        to: audience,
        parentFolder: parentFolder || undefined,
        canReply: "public",
        canReact: "public",
        dedupeKey: dedupeRef.current.key,
      });
      dedupeRef.current = null;
      onSaved?.(res?.created || res);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Couldn't save bookmark.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    setError(null);
    try {
      const res = await client.activities.createBookmark({
        type: "Folder",
        title: newFolderName.trim(),
        to: audience,
        canReply: "public",
        canReact: "public",
      });
      const created = res?.created || res;
      if (created?.id) {
        setFolders((prev) => [...prev, created]);
        setParentFolder(created.id);
      }
      setShowNewFolder(false);
      setNewFolderName("");
    } catch (e) {
      setError(e?.message || "Couldn't create folder.");
    } finally {
      setCreatingFolder(false);
    }
  }

  const imageSrc = resolveImageUrl(image, baseUrl);
  const canSave = href.trim() && title.trim() && !saving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/40 justify-end">
        <SafeAreaView
          edges={keyboardInset > 0 ? [] : ["bottom"]}
          className="bg-base-100  "
          style={{ maxHeight: "92%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-3   bg-secondary">
            <Text className="font-ui text-2xl text-secondary-content">
              Add Bookmark
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              android_ripple={{ color: "rgba(0,0,0,0.1)", borderless: true }}
            >
              <X size={20} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              paddingBottom: 20 + keyboardInset,
            }}
          >
            {/* URL */}
            <View className="mb-4">
              <FieldLabel>URL</FieldLabel>
              <TextInput
                value={href}
                onChangeText={setHref}
                editable={!hrefLocked}
                placeholder="https://…"
                placeholderTextColor={ink(0.35)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className={`  bg-field px-3 py-2.5 font-ui text-base text-base-content ${
                  hrefLocked ? "opacity-60" : ""
                }`}
              />
            </View>

            {/* Image preview */}
            {imageSrc ? (
              <View className="mb-4">
                <Image
                  source={{ uri: imageSrc }}
                  className="w-full h-40   bg-base-200"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => setImage(null)}
                  className="absolute top-2 right-2 bg-black/60 px-2 py-1"
                  android_ripple={{ color: "rgba(255,255,255,0.2)" }}
                >
                  <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-white">
                    Remove
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Title */}
            <View className="mb-4">
              <FieldLabel>Title</FieldLabel>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  fetchingPreview ? "Fetching…" : "Bookmark title"
                }
                placeholderTextColor={ink(0.35)}
                className="  bg-field px-3 py-2.5 font-ui text-base text-base-content"
              />
            </View>

            {/* Summary */}
            <View className="mb-4">
              <FieldLabel>Summary</FieldLabel>
              <TextInput
                value={summary}
                onChangeText={setSummary}
                multiline
                placeholder="Optional short summary"
                placeholderTextColor={ink(0.35)}
                className="  bg-field px-3 py-2.5 font-ui text-base text-base-content min-h-16"
              />
            </View>

            {/* Notes */}
            <View className="mb-4">
              <FieldLabel>Notes</FieldLabel>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Why are you saving this?"
                placeholderTextColor={ink(0.35)}
                className="  bg-field px-3 py-2.5 font-ui text-base text-base-content min-h-20"
              />
            </View>

            {/* Tags */}
            <View className="mb-4">
              <FieldLabel>Tags (comma-separated)</FieldLabel>
              <TextInput
                value={tags}
                onChangeText={setTags}
                placeholder="reading, design, reference"
                placeholderTextColor={ink(0.35)}
                autoCapitalize="none"
                className="  bg-field px-3 py-2.5 font-ui text-base text-base-content"
              />
            </View>

            {/* Folder */}
            <View className="mb-4">
              <FieldLabel>Folder</FieldLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 8 }}
              >
                <FolderChip
                  label="No folder"
                  selected={!parentFolder}
                  onPress={() => setParentFolder(null)}
                />
                {folders.map((f) => (
                  <FolderChip
                    key={f.id}
                    label={f.title}
                    selected={parentFolder === f.id}
                    onPress={() => setParentFolder(f.id)}
                  />
                ))}
                <Pressable
                  onPress={() => setShowNewFolder((s) => !s)}
                  className="flex-row items-center   px-3 py-2"
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                >
                  <FolderPlus
                    size={13}
                    color={ink(0.55)}
                    strokeWidth={1.75}
                  />
                  <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/55 ml-1.5">
                    New
                  </Text>
                </Pressable>
              </ScrollView>

              {showNewFolder ? (
                <View className="flex-row items-center mt-2">
                  <TextInput
                    value={newFolderName}
                    onChangeText={setNewFolderName}
                    placeholder="New folder name"
                    placeholderTextColor={ink(0.35)}
                    autoFocus
                    className="flex-1   bg-field px-3 py-2 font-ui text-sm text-base-content mr-2"
                  />
                  <Pressable
                    onPress={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                    className={`px-3 py-2 bg-primary ${
                      !newFolderName.trim() || creatingFolder ? "opacity-40" : ""
                    }`}
                    android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  >
                    <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-primary-content">
                      {creatingFolder ? "…" : "Add"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* Audience */}
            <View className="mb-4">
              <FieldLabel>Visibility</FieldLabel>
              <AudienceSelector
                value={audience}
                onChange={setAudience}
                allowPrivate
              />
            </View>

            {error ? (
              <Text className="font-ui text-xs text-error mb-3">{error}</Text>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View className="flex-row items-center justify-end px-5 py-3  ">
            <Pressable
              onPress={onClose}
              hitSlop={6}
              className="px-4 py-2.5 mr-2"
            >
              <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              android_ripple={{ color: "rgba(0,0,0,0.08)" }}
              className={`flex-row items-center px-5 py-2.5 bg-primary ${
                canSave ? "" : "opacity-40"
              }`}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FAF4E8" />
              ) : (
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
                  Save Bookmark
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function FolderChip({ label, selected, onPress }) {
  const ink = useInk();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
    >
      {/* Background on an inner View so a chip repaints when (de)selected —
          a bg on the ripple-owning Pressable node sticks on Android. */}
      <View
        className="px-3 py-2"
        style={{ backgroundColor: selected ? "#5588B1" : "#F4F4F4" }}
      >
        <Text
          className="font-ui uppercase tracking-[0.14em] text-[11px]"
          style={{ color: selected ? "#F4F5F7" : ink(0.7) }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
