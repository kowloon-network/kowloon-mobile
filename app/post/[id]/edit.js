// Post edit — full parity with the composer's editable surface for an existing
// post. Author-only. Editable: body, title (non-Note types), Event start/end
// times, audience (all types), Media attachments (add/remove), and the featured
// image (Article/Event). Post type and href are still fixed after posting.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  CoreBridge,
  DEFAULT_TOOLBAR_ITEMS,
  Images,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
} from "@10play/tentap-editor";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { DateTimeField } from "../../../src/components/posts/DateTimeField.jsx";
import { AudienceSelector } from "../../../src/components/posts/AudienceSelector.jsx";
import { ReplyReactScope } from "../../../src/components/posts/ReplyReactScope.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { useKeyboardInset } from "../../../src/lib/useKeyboardInset.js";
import { uploadFile } from "../../../src/lib/uploadFile.js";
import { selectActiveAccount } from "../../../src/state/accountsSlice.js";
import { pmToMarkdown } from "../../../src/lib/pmToMarkdown.js";
import { useInk } from "../../../src/lib/useInk.js";

const TOOLBAR_HEIGHT = 44;
const EDITOR_HEIGHT = 320;
// The default editor toolbar minus the task-list (checkbox) button — matches
// the composer's toolbar.
const TOOLBAR_ITEMS = DEFAULT_TOOLBAR_ITEMS.filter(
  (item) => item.image?.() !== Images.checkList
);

const pad = (n) => String(n).padStart(2, "0");

// Split an ISO datetime into the YYYY-MM-DD / HH:MM parts the DateTimeField expects.
function splitDateTime(iso) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

function joinDateTime(date, time) {
  if (!date) return undefined;
  // Encode the device's LOCAL wall-clock as a full UTC ISO instant so event
  // times don't shift by the viewer's offset on display (#63). Mirrors compose.js.
  const [y, mo, d] = String(date).split("-").map(Number);
  const [h, mi] = String(time || "00:00").split(":").map(Number);
  if (!y || !mo || !d) return time ? `${date}T${time}` : date;
  const dt = new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0);
  return isNaN(dt.getTime()) ? (time ? `${date}T${time}` : date) : dt.toISOString();
}

function kindFromMime(mime = "", name = "") {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (/\.(m4a|aac|mp3|wav|ogg|flac)$/.test(n)) return "audio";
  if (/\.(mp4|mov|webm|mkv|avi)$/.test(n)) return "video";
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/.test(n)) return "image";
  return "other";
}

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

// The rich editor lives in its own component so it can be created WITH the post
// body as initialContent. (Creating an empty editor and calling setContent once
// it reports ready was unreliable — the content was dropped.) It mounts only
// after the post loads, and hands its editor instance up via editorRef so the
// parent can serialize on save.
function PostBodyEditor({ initialHtml, editorRef }) {
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
  // Fixed height with the WebView's own internal scroll. This works because the
  // editor is a sibling of the metadata ScrollView (not nested inside it), so
  // nothing steals the scroll gesture.
  return (
    <View style={{ height: EDITOR_HEIGHT }} className="bg-field border border-base-300">
      <View style={{ height: TOOLBAR_HEIGHT }}>
        <Toolbar editor={editor} hidden={false} items={TOOLBAR_ITEMS} />
      </View>
      <View className="flex-1">
        <RichText editor={editor} />
      </View>
    </View>
  );
}

export default function EditPost() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const { keyboardInset } = useKeyboardInset();
  const insets = useSafeAreaInsets();
  const ink = useInk();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [audience, setAudience] = useState("@public");
  const [canReply, setCanReply] = useState("@public");
  const [canReact, setCanReact] = useState("@public");

  // Unified attachment model (Media). Existing items carry { existing:true,
  // fileId, url }; newly picked items carry { existing:false, uri }.
  const [attachments, setAttachments] = useState([]);
  // Featured image (Article/Event): existing { existing:true, fileId, url },
  // newly picked { existing:false, uri }, or null when there is none/removed.
  const [featuredImage, setFeaturedImage] = useState(null);

  // Rich text editor — rendered by <PostBodyEditor> once the post loads, so it
  // can be created with the body as initialContent. editorRef receives the
  // editor instance so handleSubmit can serialize it on save.
  const [initialBodyHtml, setInitialBodyHtml] = useState(null);
  const editorRef = useRef(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.feeds.getPost({ postId: String(id) });
      const doc = res?.post || res?.object || res;
      setPost(doc);
      setTitle(doc?.title || doc?.name || "");
      // Load the rendered HTML body into the rich editor; on save we serialize
      // it back to Markdown source via pmToMarkdown. Using the body (not the raw
      // source) means the editor shows formatted text, not escaped markdown.
      setInitialBodyHtml(doc?.body || "");
      setAudience(doc?.to || "@public");
      // Reply/react default to the post audience when they were left to inherit.
      setCanReply(doc?.canReply || doc?.to || "@public");
      setCanReact(doc?.canReact || doc?.to || "@public");
      if (doc?.event?.startDate || doc?.startTime) {
        const s = splitDateTime(doc.event?.startDate || doc.startTime);
        setStartDate(s.date);
        setStartTime(s.time);
      }
      if (doc?.event?.endDate || doc?.endTime) {
        const e = splitDateTime(doc.event?.endDate || doc.endTime);
        setEndDate(e.date);
        setEndTime(e.time);
      }

      // Existing Media attachments — the detail route now includes the source
      // fileId on each resolved entry so we can preserve kept ones on save.
      if (doc?.type === "Media" && Array.isArray(doc.attachments)) {
        setAttachments(
          doc.attachments
            .filter((a) => a?.fileId)
            .map((a) => ({
              existing: true,
              fileId: a.fileId,
              url: a.url,
              name: a.name || "",
              mimeType: a.mediaType || "",
              kind: kindFromMime(a.mediaType, a.name),
            }))
        );
      }

      // Existing featured image (Article/Event). For the owner, `image` stays
      // the raw file ID; `featuredImage` is the resolved display URL.
      if ((doc?.type === "Article" || doc?.type === "Event") && doc?.image) {
        const isFileId =
          typeof doc.image === "string" && doc.image.startsWith("file:");
        setFeaturedImage({
          existing: true,
          fileId: isFileId ? doc.image : null,
          url:
            doc.featuredImage ||
            (typeof doc.image === "string" && doc.image.startsWith("http")
              ? doc.image
              : null),
        });
      }
    } catch (e) {
      setLoadError(e?.message || "Couldn't load this post.");
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  const type = post?.type || "Note";
  const ownerId = post?.actorId || post?.actor?.id;
  const isOwner = !!account?.id && ownerId === account.id;
  const hasTitleField = type !== "Note";
  const isEvent = type === "Event";
  const isMedia = type === "Media";
  const hasFeatured = type === "Article" || type === "Event";

  async function pickFeaturedImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setFeaturedImage({
        existing: false,
        uri: asset.uri,
        name: asset.fileName || `image-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
    } catch (e) {
      setError(e?.message || "Couldn't open the photo library.");
    }
  }

  async function pickPhotosOrVideos() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        // quality 1.0 + allowsEditing false keeps animated GIFs animated on
        // Android (otherwise the pick is flattened to a single JPEG frame).
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      const next = result.assets.map((a) => {
        const isVideo = a.type === "video";
        return {
          existing: false,
          uri: a.uri,
          name:
            a.fileName ||
            `${isVideo ? "video" : "image"}-${Date.now()}.${
              isVideo ? "mp4" : "jpg"
            }`,
          mimeType: a.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          kind: isVideo ? "video" : "image",
        };
      });
      setAttachments((prev) => [...prev, ...next]);
    } catch (e) {
      setError(e?.message || "Couldn't open the photo library.");
    }
  }

  async function pickAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const next = result.assets.map((a) => ({
        existing: false,
        uri: a.uri,
        name: a.name || `audio-${Date.now()}.mp3`,
        mimeType: a.mimeType || "audio/mpeg",
        kind: "audio",
      }));
      setAttachments((prev) => [...prev, ...next]);
    } catch (e) {
      setError(e?.message || "Couldn't open audio picker.");
    }
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (submitting) return;
    const editorDoc = editorRef.current ? await editorRef.current.getJSON() : null;
    const trimmedContent = (pmToMarkdown(editorDoc) || "").trim();
    const trimmedTitle = title.trim();
    // Only a Note truly requires body text; other types can be a title, an
    // attachment set, a featured image, or just an audience change.
    if (type === "Note" && !trimmedContent) {
      setError("There's nothing to save.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updates = { content: trimmedContent, to: audience, canReply, canReact };
      if (hasTitleField) updates.title = trimmedTitle || "";
      if (isEvent) {
        updates.startTime = joinDateTime(startDate, startTime);
        updates.endTime = joinDateTime(endDate, endTime) || "";
      }

      // Media attachments — upload any newly picked files, then send the
      // combined kept-plus-new set as { fileId, title } (server coerces to the
      // [String] file-ID schema).
      if (isMedia) {
        const fresh = attachments.filter((a) => !a.existing);
        let uploaded = [];
        if (fresh.length > 0) {
          const results = await Promise.all(
            fresh.map((a) =>
              uploadFile(client, {
                uri: a.uri,
                name: a.name,
                mimeType: a.mimeType,
                title: a.name,
                to: audience,
                generateThumbnail: a.kind === "image",
              })
            )
          );
          uploaded = results
            .map((r, i) => ({ fileId: r?.file?.id, title: fresh[i].name || undefined }))
            .filter((x) => x.fileId);
        }
        const kept = attachments
          .filter((a) => a.existing && a.fileId)
          .map((a) => ({ fileId: a.fileId, title: a.name || undefined }));
        updates.attachments = [...kept, ...uploaded];
      }

      // Featured image — upload a newly picked one, keep the existing file ID,
      // or send "" to clear it.
      if (hasFeatured) {
        if (!featuredImage) {
          updates.featuredImage = "";
        } else if (featuredImage.existing) {
          updates.featuredImage = featuredImage.fileId || featuredImage.url || "";
        } else {
          const res = await uploadFile(client, {
            uri: featuredImage.uri,
            name: featuredImage.name,
            mimeType: featuredImage.mimeType,
            to: audience,
            generateThumbnail: true,
          });
          updates.featuredImage = res?.file?.id || "";
        }
      }

      await client.activities.updatePost({ postId: String(id), updates });
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't save changes.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title={`Edit ${type}`} />

      {loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : loadError ? (
        <View className="py-20 items-center px-6">
          <Text className="font-ui text-base text-error text-center mb-4">
            {loadError}
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : !isOwner ? (
        <View className="py-20 items-center px-6">
          <Text className="font-ui text-base text-base-content/70 text-center mb-4">
            You can only edit your own posts.
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : post ? (
        <>
          {/* Title + editor sit ABOVE the scroll area so the editor's own
              WebView handles scrolling (a parent ScrollView would steal the
              pan gesture, which is why nesting it didn't scroll). */}
          <View className="px-5 pt-4">
            {hasTitleField ? (
              <View className="mb-4">
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={`${type} title`}
                  placeholderTextColor={ink(0.35)}
                  className="  bg-field px-3 py-2.5 font-ui text-base text-base-content"
                />
              </View>
            ) : null}

            <FieldLabel>{type === "Note" ? "Body" : "Content"}</FieldLabel>
            {/* Rich editor — same tentap editor as the composer. Mounts with the
                loaded body as initialContent. */}
            {initialBodyHtml !== null ? (
              <PostBodyEditor initialHtml={initialBodyHtml} editorRef={editorRef} />
            ) : (
              <View
                style={{ height: EDITOR_HEIGHT }}
                className="bg-base-200 border border-base-300"
              />
            )}
          </View>

          {/* Metadata fields scroll independently below the editor. */}
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 20 + keyboardInset,
            }}
          >
            {isEvent ? (
              <>
                <View className="mb-3">
                  <DateTimeField
                    label="Starts"
                    dateValue={startDate}
                    timeValue={startTime}
                    onDateChange={setStartDate}
                    onTimeChange={setStartTime}
                  />
                </View>
                <View className="mb-5">
                  <DateTimeField
                    label="Ends (optional)"
                    dateValue={endDate}
                    timeValue={endTime}
                    onDateChange={setEndDate}
                    onTimeChange={setEndTime}
                  />
                </View>
              </>
            ) : null}

            {hasFeatured ? (
              <View className="mb-5">
                <FieldLabel>Featured Image</FieldLabel>
                {featuredImage ? (
                  <View>
                    <Image
                      source={{ uri: featuredImage.url || featuredImage.uri }}
                      className="w-full h-48 bg-base-200"
                      resizeMode="cover"
                    />
                    <View className="flex-row mt-2" style={{ gap: 8 }}>
                      <Pressable
                        onPress={pickFeaturedImage}
                        className="px-4 py-2.5 bg-base-200"
                        android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                      >
                        <Text className="font-ui text-sm text-base-content">
                          Replace
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setFeaturedImage(null)}
                        className="px-4 py-2.5 bg-base-200"
                        android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                      >
                        <Text className="font-ui text-sm text-error">Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={pickFeaturedImage}
                    className="px-4 py-3 bg-base-200 items-center"
                    android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  >
                    <Text className="font-ui text-sm text-base-content">
                      Add Featured Image
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {isMedia ? (
              <View className="mb-5">
                <FieldLabel>Attachments</FieldLabel>
                {attachments.length > 0 ? (
                  <View className="mb-2" style={{ gap: 8 }}>
                    {attachments.map((a, i) => (
                      <View
                        key={a.fileId || a.uri || i}
                        className="flex-row items-center bg-base-200 p-2"
                      >
                        {a.kind === "image" ? (
                          <Image
                            source={{ uri: a.url || a.uri }}
                            className="w-14 h-14 bg-base-300"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-14 h-14 bg-base-300 items-center justify-center">
                            <Text className="font-ui text-[10px] uppercase tracking-wide text-base-content/60">
                              {a.kind}
                            </Text>
                          </View>
                        )}
                        <Text
                          numberOfLines={1}
                          className="flex-1 mx-3 font-ui text-sm text-base-content"
                        >
                          {a.name || a.kind}
                        </Text>
                        <Pressable
                          onPress={() => removeAttachment(i)}
                          hitSlop={8}
                          className="p-1.5"
                        >
                          <X size={18} color="#B00020" strokeWidth={2} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View className="flex-row" style={{ gap: 8 }}>
                  <Pressable
                    onPress={pickPhotosOrVideos}
                    className="flex-1 px-4 py-3 bg-base-200 items-center"
                    android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  >
                    <Text className="font-ui text-sm text-base-content">
                      Add Photos / Videos
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={pickAudio}
                    className="flex-1 px-4 py-3 bg-base-200 items-center"
                    android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  >
                    <Text className="font-ui text-sm text-base-content">
                      Add Audio
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View className="mb-5">
              <FieldLabel>Visible To</FieldLabel>
              <AudienceSelector
                value={audience}
                onChange={(v) => {
                  setAudience(v);
                  setCanReply(v);
                  setCanReact(v);
                }}
              />
              <View className="mt-2">
                <ReplyReactScope
                  audience={audience}
                  canReply={canReply}
                  canReact={canReact}
                  onChangeReply={setCanReply}
                  onChangeReact={setCanReact}
                />
              </View>
            </View>

            {error ? (
              <Text className="font-ui text-xs text-error mb-3">{error}</Text>
            ) : null}
          </ScrollView>

          <View
            className="flex-row items-center justify-end px-5 pt-3  "
            style={{
              paddingBottom: (keyboardInset > 0 ? 0 : insets.bottom) + 12,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={6}
              className="px-4 py-2.5 mr-2"
            >
              <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              android_ripple={{ color: "rgba(0,0,0,0.08)" }}
              className={`flex-row items-center px-5 py-2.5 bg-primary ${
                submitting ? "opacity-40" : ""
              }`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FAF4E8" />
              ) : (
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
                  Save Changes
                </Text>
              )}
            </Pressable>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}
