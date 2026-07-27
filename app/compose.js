// Compose a post.
//
// Layout: post-type picker across the top, then the editor — a bordered box
// with the 10tap formatting toolbar on top of it (like the web composer) and
// the editing area filling the rest — then the audience selector + Cancel/
// Post below. A top toolbar is always visible, so formatting never depends on
// keyboard position. The bottom controls clear the keyboard via an explicit
// measured inset.
//
//
// On submit: pull the editor's ProseMirror JSON, convert to Markdown (the
// server stores Markdown source), createPost() via @kowloon/client.

import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  CoreBridge,
  DEFAULT_TOOLBAR_ITEMS,
  Images,
  RichText,
  TenTapStartKit,
  Toolbar,
  useBridgeState,
  useEditorBridge,
} from "@10play/tentap-editor";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import { PostTypeDropdown } from "../src/components/posts/PostTypeDropdown.jsx";
import { PostTypeIcon } from "../src/components/posts/PostTypeIcon.jsx";
import { AudienceSelector } from "../src/components/posts/AudienceSelector.jsx";
import { ReplyReactScope } from "../src/components/posts/ReplyReactScope.jsx";
import { LocationField } from "../src/components/posts/LocationField.jsx";
import { DateTimeField } from "../src/components/posts/DateTimeField.jsx";
import { useActiveClient } from "../src/lib/useActiveClient.js";
import { requestFeedRefresh } from "../src/lib/feedRefreshSignal.js";
import { consumePendingShare } from "../src/lib/pendingShare.js";
import { useKeyboardInset } from "../src/lib/useKeyboardInset.js";
import { parseKowloonUrl } from "../src/lib/parseKowloonUrl.js";
import { pmToMarkdown } from "../src/lib/pmToMarkdown.js";
import { uploadFile } from "../src/lib/uploadFile.js";
import { COMPOSABLE_TYPES, POST_TYPES } from "../src/lib/postTypes.js";

// The default editor toolbar minus the task-list (checkbox) button — matched by
// its checkList image so it survives item-order changes across versions.
const TOOLBAR_ITEMS = DEFAULT_TOOLBAR_ITEMS.filter(
  (item) => item.image?.() !== Images.checkList
);

// Event date/time helpers — see project_event_datetime_logic memory.
const pad = (n) => String(n).padStart(2, "0");
function addOneHourToTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${pad(((h ?? 0) + 1) % 24)}:${pad(m ?? 0)}`;
}
function nextRoundHour() {
  const now = new Date();
  const h = now.getMinutes() > 0 ? (now.getHours() + 1) % 24 : now.getHours();
  return `${pad(h)}:00`;
}
function joinDateTime(date, time) {
  if (!date) return undefined;
  // Build the instant from the device's LOCAL wall-clock, then serialize to a
  // full UTC ISO. A bare "2026-07-23T00:00" has no zone, so the server read it
  // as UTC and the display (local Intl) shifted it by the viewer's offset — a
  // 00:00 event showed as 7pm the previous day in Panama (#63). Encoding the
  // real instant round-trips back to the same displayed wall-clock.
  const [y, mo, d] = String(date).split("-").map(Number);
  const [h, mi] = String(time || "00:00").split(":").map(Number);
  if (!y || !mo || !d) return time ? `${date}T${time}` : date;
  const dt = new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0);
  return isNaN(dt.getTime()) ? (time ? `${date}T${time}` : date) : dt.toISOString();
}
function kindFromMime(m) {
  const s = (m || "").toLowerCase();
  if (s.startsWith("video/")) return "video";
  if (s.startsWith("audio/")) return "audio";
  return "image";
}

// expo-image-picker throws "Attempting to launch an unregistered
// ActivityResultLauncher" when Android recreated the app's Activity (config
// change, GPS use, memory pressure, "Don't keep activities"). It's a framework
// bug; the only recovery is a full app restart. Turn the raw Java stack into a
// plain-language instruction (#72).
function pickerErrorMessage(e, fallback) {
  const m = String(e?.message || "");
  if (/ActivityResultLauncher|unregistered/i.test(m)) {
    return "Android reset the media picker. Fully close and reopen Kowloon, then try again.";
  }
  return e?.message || fallback;
}

// Video-frame thumbnails need the expo-video-thumbnails native module. Guard the
// require + call so a dev client that wasn't built with it (or any failure) just
// falls back to a labeled tile instead of crashing.
let VideoThumbnails;
try {
  VideoThumbnails = require("expo-video-thumbnails");
} catch {
  VideoThumbnails = null;
}
async function makeVideoThumb(uri) {
  if (!VideoThumbnails?.getThumbnailAsync) return null;
  try {
    const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, { time: 0 });
    return thumb || null;
  } catch {
    return null;
  }
}

export default function Compose() {
  const router = useRouter();
  const client = useActiveClient();
  // Repost / share-as-Link prefill: the action bar's Repost button navigates
  // here with `?type=Link&href=...&title=...&featuredImage=...` so the user
  // can edit before posting.
  const params = useLocalSearchParams();

  // Inbound OS share of text/files (ShareIntentHandler routed us here with
  // ?fromShare=1). Consumed once. URL shares don't use this — they arrive as
  // ?type=Link&href=... on the normal param path.
  const shareRef = useRef(params.fromShare ? consumePendingShare() : null);
  const shared = shareRef.current;

  const [type, setType] = useState(
    shared?.kind === "files"
      ? "Media"
      : shared?.kind === "text"
      ? "Note"
      : typeof params.type === "string" && COMPOSABLE_TYPES.includes(params.type)
      ? params.type
      : "Note"
  );
  const [title, setTitle] = useState(
    typeof params.title === "string" ? params.title : ""
  );
  const [linkHref, setLinkHref] = useState(
    typeof params.href === "string" ? params.href : ""
  );
  const [linkPreview, setLinkPreview] = useState(null);
  // Repost prefill: when the action bar's Repost button hands off a Kowloon
  // post, this carries the source post's featuredImage URL. It wins over the
  // link-preview fetch's image at submit time so the reshare keeps the
  // original's hero, not whatever the server's OG fetch returns.
  const [forcedFeaturedImage] = useState(
    typeof params.featuredImage === "string" && params.featuredImage
      ? params.featuredImage
      : null
  );
  // Repost prefill: a plain-text excerpt of the source post — injected into
  // the editor as a Markdown-style blockquote once the editor reports ready.
  const repostQuoteRef = useRef(
    typeof params.quote === "string" ? params.quote : ""
  );
  const repostInjectedRef = useRef(false);
  // Shared plain text (Note) — seeded into the editor once it's ready.
  const sharedTextRef = useRef(shared?.kind === "text" ? shared.text || "" : "");
  const sharedTextInjectedRef = useRef(false);
  const [previewing, setPreviewing] = useState(false);
  // When resharing a Community post, PostActionBar passes the original's audience
  // as `constrain` so this Link post can't be widened past it (#47).
  const constrainAudience =
    typeof params.constrain === "string" && params.constrain ? params.constrain : null;
  const [audience, setAudience] = useState(
    constrainAudience ||
      (typeof params.to === "string" && params.to ? params.to : "@public")
  );
  // Reply/react scope — both track the post audience until narrowed by hand.
  const [canReply, setCanReply] = useState(audience);
  const [canReact, setCanReact] = useState(audience);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  // Article featuredImage — local URI from the picker, uploaded at submit.
  const [featuredImage, setFeaturedImage] = useState(null); // { uri, name, mimeType } | null

  // Media attachments — array of { uri, name, mimeType, kind }.
  // kind: 'image' | 'video' | 'audio'. Uploaded at submit; the returned
  // file IDs become the post's attachments[] array.
  const [attachments, setAttachments] = useState(
    shared?.kind === "files" && Array.isArray(shared.files)
      ? shared.files.map((f) => {
          const kind = kindFromMime(f.mimeType);
          return {
            uri: f.uri,
            name: f.name,
            title: "",
            alt: "",
            mimeType: f.mimeType,
            kind,
            thumbUri: kind === "image" ? f.uri : null,
          };
        })
      : []
  );

  // Universal geotag — available on every post type. null when unset;
  // otherwise { name, lat, lon }.
  const [location, setLocation] = useState(null);

  // Event date/time — four separate string parts per
  // project_event_datetime_logic memory. Auto-fill rules in
  // handleStartDateChange / handleStartTimeChange below.
  const [startDatePart, setStartDatePart] = useState("");
  const [startTimePart, setStartTimePart] = useState("");
  const [endDatePart, setEndDatePart] = useState("");
  const [endTimePart, setEndTimePart] = useState("");

  function handleStartDateChange(date) {
    setStartDatePart(date);
    // Default the end date to match the start.
    setEndDatePart(date);
    if (date && !startTimePart) {
      const rounded = nextRoundHour();
      setStartTimePart(rounded);
      setEndTimePart(addOneHourToTime(rounded));
    }
  }

  function handleStartTimeChange(time) {
    setStartTimePart(time);
    if (time) setEndTimePart(addOneHourToTime(time));
  }

  async function pickFeaturedImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setFeaturedImage({
        uri: asset.uri,
        name: asset.fileName || `image-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
    } catch (e) {
      setError(pickerErrorMessage(e, "Couldn't open the photo library."));
    }
  }

  async function pickPhotosOrVideos() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        // quality MUST be 1.0 (and allowsEditing false, the default) or Android
        // re-encodes the pick to a single JPEG frame — flattening animated GIFs.
        // The server resizes non-GIF images anyway, so full quality is fine here.
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      const next = result.assets.map((a) => {
        const isVideo = a.type === "video";
        return {
          uri: a.uri,
          name:
            a.fileName ||
            `${isVideo ? "video" : "image"}-${Date.now()}.${
              isVideo ? "mp4" : "jpg"
            }`,
          title: "",
          alt: "",
          mimeType: a.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          kind: isVideo ? "video" : "image",
          // Images use their own uri as the thumbnail; video thumbs are
          // generated below (native module) and patched in.
          thumbUri: isVideo ? null : a.uri,
        };
      });
      setAttachments((prev) => [...prev, ...next]);
      for (const item of next) {
        if (item.kind === "video") {
          makeVideoThumb(item.uri).then((thumb) => {
            if (!thumb) return;
            setAttachments((prev) =>
              prev.map((att) =>
                att.uri === item.uri && att.kind === "video"
                  ? { ...att, thumbUri: thumb }
                  : att
              )
            );
          });
        }
      }
    } catch (e) {
      setError(pickerErrorMessage(e, "Couldn't open the photo library."));
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
        uri: a.uri,
        name: a.name || `audio-${Date.now()}.mp3`,
        title: "",
        alt: "",
        mimeType: a.mimeType || "audio/mpeg",
        kind: "audio",
        thumbUri: null,
      }));
      setAttachments((prev) => [...prev, ...next]);
    } catch (e) {
      setError(pickerErrorMessage(e, "Couldn't open audio picker."));
    }
  }

  // Single "Add media" entry point → a bottom-sheet chooser (photos/videos come
  // from the image picker, audio from the document picker — separate native
  // pickers, so we offer the choice). A custom sheet, not Alert.alert, so the
  // buttons lay out cleanly (Android's native 3-button alert can't be aligned).
  const [mediaSheetOpen, setMediaSheetOpen] = useState(false);
  function pickMedia() {
    setMediaSheetOpen(true);
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAttachment(index, patch) {
    setAttachments((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  // Index of the attachment whose title/alt editor is open, or null.
  const [editingIndex, setEditingIndex] = useState(null);

  // The Android window doesn't reliably resize for the keyboard under Expo
  // Go, so the content area is padded at the bottom by the measured keyboard
  // inset; keyboard down, it clears the nav-bar safe-area inset instead.
  const { isKeyboardUp, keyboardInset } = useKeyboardInset();
  const insets = useSafeAreaInsets();
  const bottomPad = isKeyboardUp ? keyboardInset : insets.bottom;

  // Stable idempotency key for this composing session.
  const dedupeKey = useRef(
    `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  ).current;

  const editor = useEditorBridge({
    // Don't blanket-focus the body — only Note focuses it (below); the titled
    // types (Article/Media/Event) focus their title field, so the form opens at
    // the top with fields visible.
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: "",
    // Give the editor content breathing room from the edge — the WebView has
    // no horizontal padding by default, so text sat flush against the edge.
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(`
        .ProseMirror { padding: 10px 16px; }
      `),
    ],
  });
  const editorState = useBridgeState(editor);
  const handedOff = useRef(false);

  // Keyboard handoff: a hidden focusable TextInput (rendered below) auto-
  // focuses on mount and raises the soft keyboard. Once the editor's WebView
  // reports ready, move focus into it — the keyboard stays up across the
  // handoff since focus passes straight from one text input to another.
  useEffect(() => {
    if (editorState.isReady && !handedOff.current) {
      handedOff.current = true;
      // Only pull focus into the editor for Notes; other types keep focus on
      // their own native input (title / link URL), which stays visible.
      if (type === "Note") editor.focus();
    }
    // Repost: once the editor is up, drop the source post's excerpt in as a
    // blockquote. Followed by an empty paragraph so the cursor lands below
    // the quote — ready for the user's own comment.
    if (
      editorState.isReady &&
      !repostInjectedRef.current &&
      repostQuoteRef.current.trim()
    ) {
      repostInjectedRef.current = true;
      const escaped = repostQuoteRef.current
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n+/g, "<br>");
      try {
        editor.setContent(`<blockquote><p>${escaped}</p></blockquote><p></p>`);
      } catch {
        // editor not ready or unreachable — skip silently
      }
    }

    // Shared text (from the OS share sheet): seed the body as a paragraph.
    if (
      editorState.isReady &&
      !sharedTextInjectedRef.current &&
      sharedTextRef.current.trim()
    ) {
      sharedTextInjectedRef.current = true;
      const escaped = sharedTextRef.current
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n+/g, "<br>");
      try {
        editor.setContent(`<p>${escaped}</p>`);
      } catch {
        // editor not ready or unreachable — skip silently
      }
    }
  }, [editorState.isReady, editor]);

  // Link preview: when the user types/pastes a URL in the Link composer, fetch
  // its OG metadata from the server (debounced) and auto-populate the title
  // if blank. The image (if any) is held in state and sent as featuredImage.
  useEffect(() => {
    if (type !== "Link" || !client) {
      setLinkPreview(null);
      return;
    }
    const href = linkHref.trim();
    if (!href) {
      setLinkPreview(null);
      return;
    }
    try {
      new URL(href);
    } catch {
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const meta = await client.feeds.getLinkPreview({ url: href });
        if (cancelled) return;
        setLinkPreview(meta || null);
        if (meta?.title && !title) setTitle(meta.title);

        // Auto-populate the editor body with the preview summary if the
        // editor is currently empty. (Matches the web composer's behaviour.)
        // Skip when we have a repost-quote — that's our own injected body,
        // we don't want the preview's summary stomping on it.
        if (meta?.summary && !repostQuoteRef.current.trim()) {
          try {
            const current = (await editor.getText()) || "";
            if (!cancelled && !current.trim()) {
              const escaped = meta.summary
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n+/g, "<br>");
              // Drop the preview summary in as a blockquote (it's the source's
              // text, not the user's own), with an empty paragraph after so the
              // cursor lands below — same pattern as the repost quote above.
              editor.setContent(`<blockquote><p>${escaped}</p></blockquote><p></p>`);
            }
          } catch {
            // editor not ready or unreachable — skip silently
          }
        }
      } catch {
        // Non-fatal — preview is enhancement-only.
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // title intentionally not in deps: we only auto-populate it ONCE when
    // preview first arrives; subsequent edits stay the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkHref, type, client]);

  const composable = COMPOSABLE_TYPES.includes(type);

  async function handlePost() {
    setError(null);
    if (type === "Article" && !title.trim()) {
      setError("Articles need a title.");
      return;
    }
    if (type === "Link") {
      const href = linkHref.trim();
      if (!href) {
        setError("Add a link URL.");
        return;
      }
      try {
        new URL(href);
      } catch {
        setError("That doesn't look like a valid URL.");
        return;
      }
    }
    if (type === "Event" && !startDatePart) {
      setError("Events need a start date.");
      return;
    }

    let markdown = "";
    try {
      markdown = pmToMarkdown(await editor.getJSON());
    } catch {
      setError("Couldn't read the editor content.");
      return;
    }
    // Notes require content. Media requires at least one attachment OR text.
    if (type === "Note" && !markdown.trim()) {
      setError("Write something first.");
      return;
    }
    if (type === "Media" && attachments.length === 0 && !markdown.trim()) {
      setError("Add at least one photo, video, or audio file.");
      return;
    }

    // Auto-target: if the Link's href points at any Kowloon object (post,
    // group, circle, user, page), store its canonical ID in `target` so it's a
    // first-class, durable reference — server-agnostic and independent of the
    // display URL. (See parseKowloonUrl.)
    let target;
    if (type === "Link") {
      const parsed = parseKowloonUrl(linkHref.trim());
      if (parsed?.id) target = parsed.id;
    }

    setPosting(true);
    try {
      // Upload Article's featured image first (if any). The returned file ID
      // is what gets stored on the post — the server presigns a serve URL
      // at read time.
      let articleFeaturedFileId;
      if (
        (type === "Article" || type === "Event") &&
        featuredImage?.uri
      ) {
        try {
          const res = await uploadFile(client, {
            uri: featuredImage.uri,
            name: featuredImage.name,
            mimeType: featuredImage.mimeType,
            to: audience,
            generateThumbnail: true,
          });
          articleFeaturedFileId = res?.file?.id;
        } catch (e) {
          setError(`Featured image upload failed: ${e?.message || "unknown"}`);
          setPosting(false);
          return;
        }
      }

      // Upload Media attachments in parallel; the server schema stores an
      // array of file IDs but the Create handler also normalizes the
      // { fileId, title, alt } shape (so we match the web's payload).
      let uploadedAttachments;
      if (type === "Media" && attachments.length > 0) {
        try {
          const results = await Promise.all(
            attachments.map((a) =>
              uploadFile(client, {
                uri: a.uri,
                name: a.name,
                mimeType: a.mimeType,
                // Per-attachment title → File.name, alt text → File.summary.
                title: a.title?.trim() || a.name,
                summary: a.alt?.trim() || undefined,
                to: audience,
                generateThumbnail: a.kind === "image",
              })
            )
          );
          uploadedAttachments = results
            .map((r, i) => ({
              fileId: r?.file?.id,
              title: attachments[i].title?.trim() || attachments[i].name || undefined,
              alt: attachments[i].alt?.trim() || undefined,
            }))
            .filter((x) => x.fileId);
        } catch (e) {
          setError(`Attachment upload failed: ${e?.message || "unknown"}`);
          setPosting(false);
          return;
        }
      }

      await client.activities.createPost({
        type,
        title:
          type === "Article" ||
          type === "Link" ||
          type === "Media" ||
          type === "Event"
            ? title.trim() || undefined
            : undefined,
        href: type === "Link" ? linkHref.trim() : undefined,
        target,
        // featuredImage source per type:
        //   Article / Event — the just-uploaded file ID
        //   Link            — the OG image URL from the preview fetch (server
        //                     downloads and stores it via proxyExternalImage)
        featuredImage:
          type === "Article" || type === "Event"
            ? articleFeaturedFileId || undefined
            : type === "Link"
            ? forcedFeaturedImage || linkPreview?.image || undefined
            : undefined,
        attachments: uploadedAttachments,
        location: location
          ? { type: "Place", name: location.name, lat: location.lat, lon: location.lon }
          : undefined,
        startTime:
          type === "Event"
            ? joinDateTime(startDatePart, startTimePart)
            : undefined,
        endTime:
          type === "Event"
            ? joinDateTime(endDatePart, endTimePart)
            : undefined,
        content: markdown.trim() || undefined,
        to: audience,
        canReply,
        canReact,
        dedupeKey,
      });
      requestFeedRefresh();
      router.back();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to post.");
      setPosting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["top"]}>
      {/* Content area shrinks to clear the keyboard. */}
      <View className="flex-1" style={{ paddingBottom: bottomPad }}>
        {/* Title bar — "Add New [type ▾]" dropdown replaces the icon strip */}
        <View className="flex-row items-center px-4 py-3">
          <PostTypeDropdown value={type} onChange={setType} prefix="Add New" />
        </View>

        {composable && (
          <>
            {/* Hidden keyboard-kicker — only for Note, where the editor is the
                focus target. It raises the keyboard on mount, then focus hands
                off to the editor. Other types autofocus their own visible input
                (title / link URL), which raises the keyboard directly. */}
            {type === "Note" ? (
              <TextInput
                autoFocus
                style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
              />
            ) : null}
            {/* Fields (title / media / featured) scroll in their own region and
                only take the height their content needs (flexShrink lets a tall
                attachment list give way to the editor below). The body editor is
                a separate flex-1 region so it fills the remaining space up to the
                controls + keyboard toolbar, rather than the fields pushing it off. */}
            <ScrollView
              style={{ flexGrow: 0, flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 4 }}
            >

            {type === "Link" ? (
              <View className="px-4 pt-3">
                <TextInput
                  value={linkHref}
                  onChangeText={setLinkHref}
                  placeholder="https://example.com/article"
                  placeholderTextColor="rgba(26,26,32,0.35)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  keyboardType="url"
                  className="  bg-white px-3 py-3 font-ui text-base text-base-content"
                />
                {/* Link preview — auto-fetched from /preview when href
                    changes. On a Repost, forcedFeaturedImage carries the
                    source post's hero so the preview block shows the right
                    image immediately, even before the OG fetch returns. */}
                {previewing || linkPreview || forcedFeaturedImage ? (
                  <View className="flex-row mt-2   bg-white p-2">
                    {forcedFeaturedImage ? (
                      <Image
                        source={{ uri: forcedFeaturedImage }}
                        className="w-16 h-16 mr-3   bg-base-200"
                        resizeMode="cover"
                      />
                    ) : previewing ? (
                      <View className="w-16 h-16 mr-3   bg-base-200 items-center justify-center">
                        <ActivityIndicator />
                      </View>
                    ) : linkPreview?.image ? (
                      <Image
                        source={{ uri: linkPreview.image }}
                        className="w-16 h-16 mr-3   bg-base-200"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-16 h-16 mr-3   bg-base-200" />
                    )}
                    <View className="flex-1">
                      <Text className="font-ui text-[10px] uppercase tracking-[0.14em] text-base-content/45 mb-0.5">
                        Preview
                      </Text>
                      <Text
                        className="font-ui text-sm text-base-content"
                        numberOfLines={2}
                      >
                        {linkPreview?.title ||
                          title ||
                          (previewing ? "Loading…" : "Untitled")}
                      </Text>
                      {linkPreview?.summary ? (
                        <Text
                          className="font-ui text-xs text-base-content/55 mt-0.5"
                          numberOfLines={2}
                        >
                          {linkPreview.summary}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {type === "Article" ||
            type === "Link" ||
            type === "Media" ||
            type === "Event" ? (
              <View className="px-4 pt-3">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={
                    type === "Article"
                      ? "Article title"
                      : type === "Event"
                      ? "Event title"
                      : type === "Link"
                      ? "Optional title for this link"
                      : "Optional title"
                  }
                  placeholderTextColor="rgba(26,26,32,0.35)"
                  autoFocus={type !== "Link"}
                  className="  bg-white px-3 py-3 font-ui text-lg text-base-content"
                />
              </View>
            ) : null}

            {type === "Event" ? (
              <View className="px-4 pt-3">
                <View className="mb-2">
                  <DateTimeField
                    label="Starts"
                    dateValue={startDatePart}
                    timeValue={startTimePart}
                    onDateChange={handleStartDateChange}
                    onTimeChange={handleStartTimeChange}
                  />
                </View>
                <DateTimeField
                  label="Ends (optional)"
                  dateValue={endDatePart}
                  timeValue={endTimePart}
                  onDateChange={setEndDatePart}
                  onTimeChange={setEndTimePart}
                />
              </View>
            ) : null}

            {type === "Media" ? (
              <View className="px-4 pt-3">
                {/* Empty: a compact add button so the body editor below stays
                    visible. With attachments: a 2-up thumbnail grid — tap a tile
                    to edit its title/alt, or the X to remove it. */}
                {attachments.length === 0 ? (
                  <Pressable
                    onPress={pickMedia}
                    android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                    className="flex-row items-center justify-center bg-white border border-base-300 py-4"
                  >
                    <Text className="text-xl text-base-content/45 leading-none mr-2">+</Text>
                    <Text className="font-ui uppercase tracking-[0.14em] text-xs text-base-content/55">
                      Add media
                    </Text>
                  </Pressable>
                ) : (
                  <View className="flex-row flex-wrap -mx-1">
                    {attachments.map((att, i) => (
                      <View key={`${att.uri}-${i}`} className="w-1/2 p-1">
                        <Pressable
                          onPress={() => setEditingIndex(i)}
                          android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                          style={{ aspectRatio: 1 }}
                          className="bg-base-200 overflow-hidden"
                        >
                          {att.thumbUri ? (
                            <Image
                              source={{ uri: att.thumbUri }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="flex-1 items-center justify-center">
                              <Text className="text-2xl text-base-content/40">
                                {att.kind === "audio" ? "♪" : "▶"}
                              </Text>
                              <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45 mt-1">
                                {att.kind === "audio" ? "Audio" : "Video"}
                              </Text>
                            </View>
                          )}
                          {att.kind === "video" && att.thumbUri ? (
                            <View className="absolute inset-0 items-center justify-center">
                              <View className="w-9 h-9 bg-black/50 items-center justify-center">
                                <Text className="text-white text-base">▶</Text>
                              </View>
                            </View>
                          ) : null}
                          {att.kind !== "audio" && !att.alt?.trim() ? (
                            <View className="absolute bottom-1 left-1 bg-black/55 px-1.5 py-0.5">
                              <Text className="font-ui text-[9px] tracking-wider text-white">
                                ALT?
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                        {/* Quick remove — no need to open the editor. */}
                        <Pressable
                          onPress={() => removeAttachment(i)}
                          hitSlop={8}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/60 items-center justify-center"
                        >
                          <Text className="text-white text-xs leading-none">✕</Text>
                        </Pressable>
                      </View>
                    ))}
                    <View className="w-1/2 p-1">
                      <Pressable
                        onPress={pickMedia}
                        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                        style={{ aspectRatio: 1 }}
                        className="bg-white border border-base-300 items-center justify-center"
                      >
                        <Text className="text-3xl text-base-content/40 leading-none">
                          +
                        </Text>
                        <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55 mt-1">
                          Add
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            {type === "Article" || type === "Event" ? (
              <View className="px-4 pt-3">
                {featuredImage ? (
                  <View className="  bg-white">
                    <Image
                      source={{ uri: featuredImage.uri }}
                      className="w-full h-40"
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => setFeaturedImage(null)}
                      hitSlop={6}
                      className="absolute top-1.5 right-1.5 bg-black/65 px-2 py-1"
                    >
                      <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-white">
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={pickFeaturedImage}
                    android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                    className="  bg-white py-5 items-center"
                  >
                    <Text className="font-ui uppercase tracking-[0.14em] text-xs text-base-content/55">
                      + Add featured image
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {error ? (
              <Text className="font-ui text-sm text-error px-4 pt-3">
                {error}
              </Text>
            ) : null}

            </ScrollView>

            {/* Editor body — fills the space between the fields above and the
                controls + pinned toolbar below, and scrolls INTERNALLY (issue
                #76). scrollEnabled/nestedScrollEnabled turn on the WebView's own
                scroll (10tap disables it by default), so long text scrolls in
                place instead of the parent stealing the gesture, and the field
                stays a sensible height instead of growing to thousands of px. */}
            <View className="mx-4 mt-3" style={{ flex: 1, minHeight: 140 }}>
              <RichText
                editor={editor}
                scrollEnabled
                nestedScrollEnabled
              />
            </View>

            {/* Universal location picker — pinned above the controls so a
                geotag is always one tap away regardless of post type. */}
            <View className="px-4 pt-2">
              <LocationField value={location} onChange={setLocation} />
            </View>

            {/* Audience + Cancel/Post — below the editor body. Changing the
                audience resets the reply/react scope to match it. */}
            <View className="flex-row items-stretch px-4 pt-3">
              <View className="flex-1 mr-2">
                <AudienceSelector
                  value={audience}
                  constrainTo={constrainAudience}
                  onChange={(v) => {
                    setAudience(v);
                    setCanReply(v);
                    setCanReact(v);
                  }}
                />
              </View>
              <Pressable
                onPress={() => router.back()}
                disabled={posting}
                className="  px-4 justify-center mr-2"
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              >
                <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handlePost}
                disabled={posting}
                className={`  px-5 justify-center ${
                  posting ? "bg-primary/60" : "bg-primary"
                }`}
                android_ripple={{ color: "rgba(255,255,255,0.15)" }}
              >
                {posting ? (
                  <ActivityIndicator color="#FAF4E8" />
                ) : (
                  <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-primary-content">
                    Post
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Advanced — reply/react scope, tucked under the To selector */}
            <View className="px-4 pb-3">
              <ReplyReactScope
                audience={audience}
                canReply={canReply}
                canReact={canReact}
                onChangeReply={setCanReply}
                onChangeReact={setCanReact}
              />
            </View>
          </>
        )}
      </View>

      {/* Formatting toolbar, pinned just above the keyboard. tentap auto-hides
          it unless the body editor is focused (Toolbar's default `hidden`
          behaviour), so it appears only while you're writing the body — never
          over the title fields or when the composer is idle. */}
      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: keyboardInset }}
        pointerEvents="box-none"
      >
        <Toolbar editor={editor} items={TOOLBAR_ITEMS} />
      </View>

      {/* Add-media chooser — a centered dialog (not Alert.alert, whose Android
          3-button layout can't be aligned). Launch the picker just after the
          dialog closes to avoid the Android modal-dismiss / picker-open race. */}
      <Modal
        visible={mediaSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMediaSheetOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-8"
          onPress={() => setMediaSheetOpen(false)}
        >
          <Pressable onPress={() => {}} className="w-full max-w-sm bg-base-100">
            <View className="px-5 py-3 bg-secondary">
              <Text className="font-ui text-lg text-secondary-content">Add media</Text>
            </View>
            <Pressable
              onPress={() => {
                setMediaSheetOpen(false);
                setTimeout(pickPhotosOrVideos, 180);
              }}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="px-5 py-4 border-b border-base-200"
            >
              <Text className="font-ui text-base text-base-content">Photo or Video</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMediaSheetOpen(false);
                setTimeout(pickAudio, 180);
              }}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="px-5 py-4 border-b border-base-200"
            >
              <Text className="font-ui text-base text-base-content">Audio</Text>
            </Pressable>
            <Pressable
              onPress={() => setMediaSheetOpen(false)}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="px-5 py-4"
            >
              <Text className="font-ui text-base text-base-content/55">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Per-attachment editor — larger preview + title / alt text + delete. */}
      <Modal
        visible={editingIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingIndex(null)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-6"
          style={{ paddingBottom: keyboardInset }}
          onPress={() => setEditingIndex(null)}
        >
            <Pressable onPress={() => {}} className="w-full max-w-sm bg-base-100">
              {editingIndex !== null && attachments[editingIndex] ? (
                <>
                  {attachments[editingIndex].thumbUri ? (
                    <Image
                      source={{ uri: attachments[editingIndex].thumbUri }}
                      style={{ width: "100%", height: 200 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{ height: 120 }}
                      className="bg-base-200 items-center justify-center"
                    >
                      <Text className="text-4xl text-base-content/40">
                        {attachments[editingIndex].kind === "audio" ? "♪" : "▶"}
                      </Text>
                    </View>
                  )}
                  <View className="p-5">
                    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
                      Title
                    </Text>
                    <TextInput
                      value={attachments[editingIndex].title}
                      onChangeText={(v) => updateAttachment(editingIndex, { title: v })}
                      placeholder="Optional title"
                      placeholderTextColor="rgba(26,26,32,0.35)"
                      className="bg-white border border-base-300 px-3 py-2.5 font-ui text-base text-base-content mb-4"
                    />
                    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
                      Alt text
                    </Text>
                    <TextInput
                      value={attachments[editingIndex].alt}
                      onChangeText={(v) => updateAttachment(editingIndex, { alt: v })}
                      placeholder="Describe this for screen readers"
                      placeholderTextColor="rgba(26,26,32,0.35)"
                      multiline
                      style={{ minHeight: 64 }}
                      className="bg-white border border-base-300 px-3 py-2.5 font-ui text-base text-base-content"
                    />
                    <View className="flex-row items-center justify-between mt-5">
                      <Pressable
                        onPress={() => {
                          const idx = editingIndex;
                          setEditingIndex(null);
                          removeAttachment(idx);
                        }}
                        hitSlop={6}
                        className="px-2 py-2"
                      >
                        <Text className="font-ui uppercase tracking-[0.14em] text-xs text-error">
                          Delete
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditingIndex(null)}
                        android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                        className="px-6 py-2.5 bg-primary"
                      >
                        <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
                          Done
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : null}
            </Pressable>
          </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
