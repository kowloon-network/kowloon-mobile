// BookmarkActionSheet — context menu for a single bookmark or folder.
// Surfaces edit / move / delete; the sub-modals (BookmarkEdit, MovePicker)
// live here so the whole owner-only flow is in one place.
//
// `target` is { node, onComplete? } | null. The screen owning the tree
// passes setMenuTarget as `onMenu` to TreeNode. `onMutated` fires after a
// successful edit/move/delete so the tree can refresh affected branches.

import { useEffect, useMemo, useState } from "react";
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
import { X, Folder, FolderOpen, FileText } from "lucide-react-native";

import { AudienceSelector } from "../posts/AudienceSelector.jsx";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { useInk } from "../../lib/useInk.js";

function ActionRow({ label, onPress, destructive, muted }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      className="px-5 py-3.5  "
    >
      <Text
        className={`font-ui text-base ${
          destructive
            ? "text-error"
            : muted
            ? "text-base-content/55"
            : "text-base-content"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

export function BookmarkActionSheet({
  target,
  client,
  account,
  onClose,
  onMutated,
}) {
  // mode null = action menu; otherwise the sub-modal name
  const [mode, setMode] = useState(null);
  const node = target?.node;

  // Reset mode whenever the target changes.
  useEffect(() => {
    setMode(null);
  }, [target]);

  if (!node) return null;
  const isFolder = node.type === "Folder";

  function handleDelete() {
    const title = isFolder ? "Delete folder?" : "Delete bookmark?";
    const message = isFolder
      ? "Everything inside this folder will also be deleted. This can't be undone."
      : "This can't be undone.";
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await client.activities.deleteBookmark({ bookmarkId: node.id });
            onMutated?.();
          } catch (e) {
            Alert.alert("Couldn't delete", e?.message || "Please try again.");
          }
        },
      },
    ]);
  }

  if (mode === "edit") {
    return (
      <EditModal
        node={node}
        client={client}
        onClose={onClose}
        onSaved={onMutated}
      />
    );
  }
  if (mode === "move") {
    return (
      <MoveModal
        node={node}
        client={client}
        account={account}
        onClose={onClose}
        onMoved={onMutated}
      />
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable onPress={() => {}}>
          <SafeAreaView
            edges={["bottom"]}
            className="bg-base-100  "
          >
            <View className="flex-row items-center px-5 py-3   bg-secondary">
              {isFolder ? (
                <Folder size={16} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
              ) : (
                <FileText size={16} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
              )}
              <Text
                className="font-ui text-lg text-secondary-content ml-2 flex-1"
                numberOfLines={1}
              >
                {node.title || node.href || "Untitled"}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={18} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
              </Pressable>
            </View>
            <ActionRow label="Edit" onPress={() => setMode("edit")} />
            <ActionRow label="Move to folder…" onPress={() => setMode("move")} />
            <ActionRow label="Delete" destructive onPress={handleDelete} />
            <ActionRow label="Cancel" muted onPress={onClose} />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- Edit modal --------------------------------------------------------

function EditModal({ node, client, onClose, onSaved }) {
  const isFolder = node.type === "Folder";
  const { keyboardInset } = useKeyboardInset();
  const ink = useInk();

  const [title, setTitle] = useState(node.title || "");
  const [href, setHref] = useState(node.href || "");
  const [summary, setSummary] = useState(node.summary || "");
  const [audience, setAudience] = useState(node.to || "@public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSave =
    !!title.trim() && (isFolder || !!href.trim()) && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const updates = { bookmarkId: node.id, title: title.trim(), to: audience };
      if (!isFolder) {
        updates.href = href.trim();
        updates.summary = summary.trim();
      }
      await client.activities.updateBookmark(updates);
      onSaved?.();
    } catch (e) {
      setError(e?.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible
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
          <View className="flex-row items-center justify-between px-5 py-3   bg-secondary">
            <Text className="font-ui text-2xl text-secondary-content">
              {isFolder ? "Edit Folder" : "Edit Bookmark"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
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
            <View className="mb-4">
              <FieldLabel>{isFolder ? "Folder name" : "Title"}</FieldLabel>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={isFolder ? "e.g. Recipes" : "Bookmark title"}
                placeholderTextColor={ink(0.35)}
                className="  bg-white px-3 py-2.5 font-ui text-base text-base-content"
              />
            </View>

            {!isFolder ? (
              <>
                <View className="mb-4">
                  <FieldLabel>URL</FieldLabel>
                  <TextInput
                    value={href}
                    onChangeText={setHref}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://…"
                    placeholderTextColor={ink(0.35)}
                    className="  bg-white px-3 py-2.5 font-ui text-base text-base-content"
                  />
                </View>
                <View className="mb-4">
                  <FieldLabel>Summary</FieldLabel>
                  <TextInput
                    value={summary}
                    onChangeText={setSummary}
                    multiline
                    placeholder="A short note about what this is."
                    placeholderTextColor={ink(0.35)}
                    className="  bg-white px-3 py-2.5 font-ui text-base text-base-content min-h-20"
                  />
                </View>
              </>
            ) : null}

            <View className="mb-4">
              <FieldLabel>Visibility</FieldLabel>
              <AudienceSelector value={audience} onChange={setAudience} />
            </View>

            {error ? (
              <Text className="font-ui text-xs text-error mb-3">{error}</Text>
            ) : null}
          </ScrollView>
          <View className="flex-row items-center justify-end px-5 py-3  ">
            <Pressable onPress={onClose} hitSlop={6} className="px-4 py-2.5 mr-2">
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
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- New folder modal -------------------------------------------------

export function FolderCreateModal({ visible, client, onClose, onCreated }) {
  const { keyboardInset } = useKeyboardInset();
  const ink = useInk();
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("@public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setAudience("@public");
      setError(null);
    }
  }, [visible]);

  const canSave = !!title.trim() && !saving;

  async function handleCreate() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await client.activities.createBookmark({
        type: "Folder",
        title: title.trim(),
        to: audience,
        canReply: "public",
        canReact: "public",
      });
      onCreated?.(res?.created || res);
    } catch (e) {
      setError(e?.message || "Couldn't create folder.");
    } finally {
      setSaving(false);
    }
  }

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
        >
          <View className="flex-row items-center justify-between px-5 py-3   bg-secondary">
            <Text className="font-ui text-2xl text-secondary-content">
              New Folder
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
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
            <View className="mb-4">
              <FieldLabel>Folder name</FieldLabel>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Recipes"
                placeholderTextColor={ink(0.35)}
                autoFocus
                className="  bg-white px-3 py-2.5 font-ui text-base text-base-content"
              />
            </View>
            <View className="mb-4">
              <FieldLabel>Visibility</FieldLabel>
              <AudienceSelector value={audience} onChange={setAudience} />
            </View>
            {error ? (
              <Text className="font-ui text-xs text-error mb-3">{error}</Text>
            ) : null}
          </ScrollView>
          <View className="flex-row items-center justify-end px-5 py-3  ">
            <Pressable onPress={onClose} hitSlop={6} className="px-4 py-2.5 mr-2">
              <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
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
                  Create
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Move-to-folder picker --------------------------------------------

function MoveModal({ node, client, account, onClose, onMoved }) {
  const ownerId = account?.id;
  const ink = useInk();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(node.parentFolder || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!client || !ownerId) return undefined;
    setLoading(true);
    client.feeds
      .getUserBookmarks({ userId: ownerId, type: "Folder" })
      .then((res) => {
        if (cancelled) return;
        const all = res?.orderedItems || res?.items || [];
        setFolders(all);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, ownerId]);

  // Filter out the folder being moved (server rejects self-parenting anyway,
  // but no point showing it). Descendant cycles are caught by the server's
  // depth+cycle check and surfaced as an error.
  const options = useMemo(
    () => folders.filter((f) => f.id !== node.id),
    [folders, node.id]
  );

  async function handleMove() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await client.activities.updateBookmark({
        bookmarkId: node.id,
        parentFolder: selected || null,
      });
      onMoved?.();
    } catch (e) {
      setError(e?.message || "Couldn't move.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/40 justify-end">
        <SafeAreaView
          edges={["bottom"]}
          className="bg-base-100  "
          style={{ maxHeight: "80%" }}
        >
          <View className="flex-row items-center justify-between px-5 py-3   bg-secondary">
            <Text className="font-ui text-2xl text-secondary-content">
              Move to…
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
            </Pressable>
          </View>
          <ScrollView>
            <Pressable
              onPress={() => setSelected(null)}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              className={`flex-row items-center px-5 py-3.5   ${
                selected === null ? "bg-primary/10" : ""
              }`}
            >
              <FolderOpen
                size={16}
                color={ink(0.55)}
                strokeWidth={1.75}
              />
              <Text className="font-ui text-base text-base-content ml-2">
                (Top level)
              </Text>
            </Pressable>
            {loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" />
              </View>
            ) : options.length === 0 ? (
              <Text className="font-ui text-sm text-base-content/55 px-5 py-6 text-center">
                No other folders yet.
              </Text>
            ) : (
              options.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setSelected(f.id)}
                  android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                  className={`flex-row items-center px-5 py-3.5   ${
                    selected === f.id ? "bg-primary/10" : ""
                  }`}
                >
                  <Folder
                    size={16}
                    color="#5588B1"
                    strokeWidth={1.75}
                  />
                  <Text
                    className="font-ui text-base text-base-content ml-2 flex-1"
                    numberOfLines={1}
                  >
                    {f.title || "Untitled folder"}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
          {error ? (
            <Text className="font-ui text-xs text-error px-5 py-2">{error}</Text>
          ) : null}
          <View className="flex-row items-center justify-end px-5 py-3  ">
            <Pressable onPress={onClose} hitSlop={6} className="px-4 py-2.5 mr-2">
              <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleMove}
              disabled={saving}
              android_ripple={{ color: "rgba(0,0,0,0.08)" }}
              className={`flex-row items-center px-5 py-2.5 bg-primary ${
                saving ? "opacity-40" : ""
              }`}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FAF4E8" />
              ) : (
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
                  Move
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
