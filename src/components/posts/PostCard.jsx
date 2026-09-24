// Feed post card — editorial, type-aware. Renders a preview (title + plain
// text), never the full HTML body; tapping opens the post detail screen.
//
// Post types: Note, Article, Media, Link, Event. Each gets an accent color
// and type-appropriate treatment.

import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Play, Music } from "lucide-react-native";

import { resolveEmbed } from "@kowloon/client";
import { SmartImage as Image } from "../ui/SmartImage.jsx";
import { Avatar } from "./Avatar.jsx";
import { EmbedPlayer } from "./EmbedPlayer.jsx";
import { LocationLine } from "./LocationLine.jsx";
import { PostActionBar } from "./PostActionBar.jsx";
import { ReactSummaryRow } from "./ReactSummaryRow.jsx";
import { HtmlContent } from "../HtmlContent.jsx";
import { useImageViewer } from "../ImageViewerProvider.jsx";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { useTypography } from "../../lib/TypographyContext.js";
import { useInk } from "../../lib/useInk.js";
import { openKowloonLink } from "../../lib/parseKowloonUrl.js";
import { timeAgo } from "@kowloon/client";

// Classify an attachment by mediaType, with a fallback for `.m4a` files
// which Android sometimes labels `video/mp4` even though they're audio.
// An attachment may arrive as a rich { url, mediaType, name } object (enriched
// feeds) or as a bare URL string (feeds that don't enrich — groups, My Posts —
// and enriched feeds hand back empty mediaType for stored proxy URLs).
const attUrl = (att) => (typeof att === "string" ? att : att?.url || att?.href || "");

// Full-viewer item: URL plus title (File.name) and alt (File.summary) so the
// fullscreen viewer can caption the image.
const attItem = (att) =>
  typeof att === "string"
    ? att
    : { uri: attUrl(att), title: att?.name || "", alt: att?.alt || att?.summary || "" };

function attachmentKind(att) {
  const mime = (att?.mediaType || att?.mimeType || att?.type || "").toLowerCase();
  const src = (attUrl(att) || att?.name || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (/\.(m4a|aac|mp3|wav|ogg|flac)(\?|$)/.test(src)) return "audio";
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(src)) return "video";
  // Unknown/empty mediaType: assume image. Media posts are photo-first, and
  // defaulting to an audio player was the #45 bug (images shown as "...audio").
  return "image";
}

// Static class strings — NativeWind needs the full class name at build time,
// so we can't interpolate `text-post-${type}`.
const TYPE_META = {
  Note: { label: "Note", accent: "text-post-note", bar: "bg-post-note" },
  Article: { label: "Article", accent: "text-post-article", bar: "bg-post-article" },
  Media: { label: "Media", accent: "text-post-media", bar: "bg-post-media" },
  Link: { label: "Link", accent: "text-post-link", bar: "bg-post-link" },
  Event: { label: "Event", accent: "text-post-event", bar: "bg-post-event" },
};

// Event calendar tear-off block — ported from web's EventCard.jsx (Card.md
// decision 3). Month strip in the post-event color, day number in display
// type, day-of-week below.
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function formatStartTime(start) {
  if (!start) return null;
  return new Date(start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function CalendarBlock({ date }) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <View className="w-14 border-2 border-base-300 overflow-hidden">
      <View className="items-center justify-center py-0.5 bg-post-event">
        <Text className="font-ui text-[10px] font-bold uppercase tracking-widest text-white">
          {MONTHS[d.getMonth()]}
        </Text>
      </View>
      <View className="items-center justify-center py-1 bg-base-100">
        <Text className="font-display text-3xl leading-none text-base-content">{d.getDate()}</Text>
        <Text className="font-ui text-[9px] uppercase tracking-widest text-base-content/40 mt-0.5">
          {DAYS[d.getDay()]}
        </Text>
      </View>
    </View>
  );
}

function hostOf(url) {
  if (!url) return "";
  return String(url)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
}

// "Continue reading…" excerpt hint. The server emits `post.summary` only when it
// truncated the body (>2 paragraphs or a very long paragraph — see Post.js
// generateSummary), so its presence is the signal that the card is an excerpt.
// Shown for every truncatable type (Note/Article/Event and now Link/Media).
function ContinueReading({ show }) {
  if (!show) return null;
  return (
    <Text className="font-ui italic text-base-content/45 mt-2 text-right">
      Continue reading…
    </Text>
  );
}

export function PostCard({ post, onDeleted }) {
  const router = useRouter();
  const viewer = useImageViewer();
  const client = useActiveClient();
  const currentUser = client?.auth?.getUser?.() || null;
  const meta = TYPE_META[post?.type] || TYPE_META.Note;
  const { resolved } = useTypography();
  // Font family + sizes from the user's reading preference, applied to the
  // post's content: body, title, and the author name/handle — so a post reads
  // cohesively in the chosen face. (Type label + timestamp stay UI chrome.)
  const contentFonts = {
    regular: resolved.regularFamily,
    bold: resolved.boldFamily,
    italic: resolved.italicFamily,
  };
  const titleStyle = {
    fontFamily: resolved.boldFamily,
    fontSize: Math.round(resolved.fontSize * 1.4),
    lineHeight: Math.round(resolved.fontSize * 1.6),
  };
  const ink = useInk();

  const actor = post?.actor || {};
  const handle = actor.id || post?.actorId || "";
  const name = actor.name || handle.replace(/^@/, "");
  const eventStart = post?.event?.startDate || post?.startTime;
  const eventSubheader = [formatStartTime(eventStart), post?.location?.name].filter(Boolean).join(" | ");

  const title = post?.title?.trim();
  // Articles carry a generated `summary`; Notes don't — their `body` is the
  // whole (short) post, so fall back to it.
  const previewHtml = (post?.summary || post?.body || "").trim();
  const plainPreview = post?.textPreview?.trim();
  const image = post?.featuredImage || post?.image || null;
  // For Link posts the host shown is the *external* URL's host (post.href),
  // not the Kowloon canonical post URL (post.url) — those are always our own
  // domain.
  const linkHost = post?.type === "Link" ? hostOf(post?.href) : "";
  // Rich-media embed (YouTube, …) derived from the link URL via the shared
  // recognizer — inline-capable providers get a player in the image slot.
  const embed = post?.type === "Link" && post?.href ? resolveEmbed(post.href) : null;

  function open() {
    router.push(`/post/${encodeURIComponent(post.id)}`);
  }

  function openExternal() {
    // A Kowloon link (post, group, circle, user, page) opens in-app; anything
    // else goes to the browser.
    if (post?.href) openKowloonLink(post.href);
  }

  return (
    <Pressable
      onPress={open}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      className="  bg-base-100"
    >
      <View className="px-5 py-5">
        {/* Author row — left side (avatar + name/handle) navigates to the
            user's profile; the type/time on the right stays inside the parent
            Pressable so a tap there still opens the post. */}
        <View className="flex-row items-center mb-3">
          <Pressable
            onPress={() => {
              if (handle) router.push(`/user/${encodeURIComponent(handle)}`);
            }}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            className="flex-row items-center flex-1 min-w-0"
          >
            <Avatar actor={actor} size={38} />
            <View className="flex-1 ml-3">
              {/* Byline is chrome, not reader content -- fixed font-ui
                  regardless of the reader's typography preference
                  (Card.md decision 1), matching web's PostMeta. */}
              <Text className="font-ui font-medium text-base text-base-content" numberOfLines={1}>
                {name}
              </Text>
              <Text className="font-ui text-xs text-base-content/50" numberOfLines={1}>
                {handle}
              </Text>
            </View>
          </Pressable>
          <View className="items-end ml-2">
            <Text
              className={`font-ui text-[10px] uppercase tracking-[0.16em] ${meta.accent}`}
            >
              {meta.label}
            </Text>
            <Text className="font-ui text-xs text-base-content/50 mt-0.5">
              {timeAgo(post?.publishedAt || post?.createdAt)}
            </Text>
          </View>
        </View>

        {post?.type === "Media" ? (
          /* Media: optional title, then caption, then each attachment as a
             tile. Images render in a 2-col grid; videos and audio render as
             full-width rows below. Falls back to the legacy single `image`
             field for older posts that pre-date attachments. */
          <>
            {title ? (
              <Text className="text-base-content mb-1.5" style={titleStyle}>
                {title}
              </Text>
            ) : null}
            <LocationLine location={post?.location} />
            {/* Media above the body — always, like the web card. Capped at 4
                attachments (2x2); a 5th+ replaces the last cell with a
                "+N more" link to the full post. Video/audio share the same
                cap and cell treatment as images here -- full playback lives
                on the detail screen (Card.md decision 2). */}
            {Array.isArray(post.attachments) && post.attachments.length > 0 ? (
              <View className="mb-3">
                {(() => {
                  const shown = post.attachments.slice(0, 4);
                  const extra = post.attachments.length - shown.length;
                  const imageAtts = post.attachments.filter((a) => attachmentKind(a) === "image");
                  const imageItems = imageAtts.map(attItem);
                  return (
                    <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                      {shown.map((att, i) => {
                        const kind = attachmentKind(att);
                        const isOverflowCell = i === shown.length - 1 && extra > 0;
                        const isOddFinal =
                          !isOverflowCell && shown.length > 1 && shown.length % 2 === 1 && i === shown.length - 1;
                        const cellWidth = shown.length === 1 || isOddFinal ? "100%" : "49%";
                        const onPress =
                          kind === "image"
                            ? () => viewer?.open(imageItems, imageAtts.findIndex((a) => attUrl(a) === attUrl(att)))
                            : open;
                        return (
                          <Pressable key={`${attUrl(att)}-${i}`} onPress={onPress} style={{ width: cellWidth }}>
                            <View className="relative w-full h-40 bg-base-200 items-center justify-center overflow-hidden">
                              {kind === "image" && (
                                <Image source={{ uri: attUrl(att) }} className="w-full h-full" resizeMode="cover" />
                              )}
                              {kind === "video" && <Play size={28} color={ink(0.55)} />}
                              {kind === "audio" && <Music size={28} color={ink(0.55)} />}
                              {isOverflowCell && (
                                <View className="absolute inset-0 bg-black/60 items-center justify-center">
                                  <Text className="font-ui text-sm uppercase tracking-widest text-white">
                                    +{extra} more
                                  </Text>
                                </View>
                              )}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            ) : image ? (
              <Pressable onPress={() => viewer?.open([image], 0)}>
                <Image
                  source={{ uri: image }}
                  className="w-full mb-3 bg-base-200"
                  style={{ aspectRatio: 4 / 5 }}
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
            {previewHtml ? (
              <View>
                <HtmlContent
                  html={previewHtml}
                  fonts={contentFonts}
                  fontSize={resolved.fontSize}
                  lineHeight={resolved.lineHeight}
                />
                <ContinueReading show={!!post?.summary} />
              </View>
            ) : null}
          </>
        ) : post?.type === "Link" ? (
          /* Image-first link card: image on top, then the link title, then
             the description. Image and title open the external URL; tapping
             elsewhere on the card still opens the post detail. */
          <>
            {embed?.mode === "inline" ? (
              <EmbedPlayer embed={embed} poster={image} />
            ) : image ? (
              <Pressable onPress={openExternal} className="mb-3">
                <Image
                  source={{ uri: image }}
                  className="w-full h-48   bg-base-200"
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
            {title ? (
              <Pressable onPress={openExternal}>
                <Text className={`${meta.accent} mb-1`} style={titleStyle}>
                  {title}
                </Text>
              </Pressable>
            ) : null}
            <LocationLine location={post?.location} />
            {/* Credit the ORIGINAL author when this Link is sharing another
                Kowloon post (#44) — tapping navigates to their profile, not
                the post (that's the outer card Pressable's job). Falls back
                to the bare (domain) for a plain external link, or an old
                share made before targetActor existed. */}
            {post?.targetActor ? (
              <Pressable
                onPress={() => router.push(`/user/${encodeURIComponent(post.targetActor.id)}`)}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className="flex-row items-center mb-1"
              >
                <Avatar actor={post.targetActor} size={20} />
                <Text className="font-ui text-sm text-base-content ml-2 shrink" numberOfLines={1}>
                  {post.targetActor.name ?? post.targetActor.id}
                </Text>
                {/* No (domain) here — it's redundant, already inside the handle. */}
                <Text className="font-ui text-xs text-base-content/45 ml-1.5 shrink" numberOfLines={1}>
                  {post.targetActor.id}
                </Text>
              </Pressable>
            ) : linkHost ? (
              <Text className="font-ui text-xs text-base-content/45 mb-2">
                ({linkHost})
              </Text>
            ) : null}
            {previewHtml ? (
              <>
                <HtmlContent
                  html={previewHtml}
                  fonts={contentFonts}
                  fontSize={resolved.fontSize}
                  lineHeight={resolved.lineHeight}
                />
                <ContinueReading show={!!post?.summary} />
              </>
            ) : null}
          </>
        ) : post?.type === "Event" ? (
          /* Event: calendar tear-off block beside title + subheader
             (start time | location), ported from web's EventCard.jsx
             (Card.md decision 3) -- previously fell through the generic
             branch below with only a `prominent` flag on the location. */
          <>
            <View className="flex-row mb-2" style={{ gap: 12 }}>
              <CalendarBlock date={eventStart} />
              <View className="flex-1 min-w-0">
                {title ? (
                  <Text className="text-base-content" style={titleStyle} numberOfLines={2}>
                    {title}
                  </Text>
                ) : null}
                {eventSubheader ? (
                  <Text className="font-ui text-sm font-bold text-base-content mt-1">{eventSubheader}</Text>
                ) : null}
              </View>
            </View>

            {image ? (
              <Pressable onPress={() => viewer?.open([image], 0)} className="mb-3">
                <Image source={{ uri: image }} className="w-full h-48   bg-base-200" resizeMode="cover" />
              </Pressable>
            ) : null}

            {previewHtml ? (
              <HtmlContent
                html={previewHtml}
                fonts={contentFonts}
                fontSize={resolved.fontSize}
                lineHeight={resolved.lineHeight}
              />
            ) : plainPreview ? (
              <Text
                className="text-base-content/80"
                style={{ fontFamily: resolved.regularFamily, fontSize: resolved.fontSize, lineHeight: resolved.lineHeight }}
                numberOfLines={title ? 3 : 5}
              >
                {plainPreview}
              </Text>
            ) : null}

            <ContinueReading show={!!post?.summary} />
          </>
        ) : (
          /* Default body — title + HTML preview + optional hero image. Used
             for Note and Article. */
          <>
            {title ? (
              <Text className="text-base-content mb-1.5" style={titleStyle}>
                {title}
              </Text>
            ) : null}

            {/* Notes have no title, so the LocationLine here sits directly
                between the author row and the body. Articles get a tiny
                line under the title. */}
            <LocationLine location={post?.location} />

            {/* Featured/hero image above the body — always, like the web. */}
            {image ? (
              <Pressable onPress={() => viewer?.open([image], 0)} className="mb-3 mt-1">
                <Image
                  source={{ uri: image }}
                  className="w-full h-48   bg-base-200"
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}

            {linkHost ? (
              <Text className={`font-ui text-xs mb-1.5 ${meta.accent}`}>
                {linkHost}
              </Text>
            ) : null}

            {previewHtml ? (
              <HtmlContent
                html={previewHtml}
                fonts={contentFonts}
                fontSize={resolved.fontSize}
                lineHeight={resolved.lineHeight}
              />
            ) : plainPreview ? (
              <Text
                className="text-base-content/80"
                style={{ fontFamily: resolved.regularFamily, fontSize: resolved.fontSize, lineHeight: resolved.lineHeight }}
                numberOfLines={title ? 3 : 5}
              >
                {plainPreview}
              </Text>
            ) : null}

            <ContinueReading show={!!post?.summary} />
          </>
        )}

        {/* Reaction summary — read-only emoji row + total, between body and bar (#79) */}
        <ReactSummaryRow post={post} />

        {/* Action bar — reply / react / repost / share / bookmark / more */}
        <View className="mt-1">
          <PostActionBar
            post={post}
            client={client}
            currentUser={currentUser}
            onDeleted={onDeleted}
            size="sm"
          />
        </View>
      </View>
    </Pressable>
  );
}
