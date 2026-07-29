// PostBody — the reading surface for a single post.
//
// Renders the full HTML body (no truncation, no "continue reading"), with
// type-specific chrome:
//   Note     — body only (location displayed by the caller above the body)
//   Article  — featured image + body
//   Media    — caption + attachment gallery (image grid, audio rows, video rows)
//   Link     — external title link + host + image + description body
//   Event    — start/end date+time + body (location displayed by the caller)
//
// Reading typography (font family, size, line-height) is passed in via `fonts`/
// `fontSize`/`lineHeight` so the detail screen can apply the user's prefs.

import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { openKowloonLink } from "../../lib/parseKowloonUrl.js";
import { SmartImage as Image } from "../ui/SmartImage.jsx";
import { AudioAttachment } from "./AudioAttachment.jsx";
import { VideoAttachment } from "./VideoAttachment.jsx";
import { LocationLine } from "./LocationLine.jsx";
import { HtmlContent } from "../HtmlContent.jsx";
import { useImageViewer } from "../ImageViewerProvider.jsx";
import { imageDisplayRatio } from "../../lib/imageRatio.js";

// An attachment may arrive as a rich { url, mediaType, name } object (enriched
// feeds) or as a bare URL string (feeds that don't enrich, or empty mediaType
// for stored proxy URLs).
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
  // Unknown/empty mediaType: assume image (Media posts are photo-first). #45.
  return "image";
}

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return String(url)
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
  }
}

function formatEventRange(post) {
  const start = post?.event?.startDate || post?.startTime;
  const end = post?.event?.endDate || post?.endTime;
  if (!start) return null;

  const startD = new Date(start);
  if (Number.isNaN(startD.getTime())) return null;
  const endD = end ? new Date(end) : null;

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const sDate = dateFmt.format(startD);
  const sTime = timeFmt.format(startD);

  if (!endD || Number.isNaN(endD.getTime())) {
    return { primary: sDate, secondary: sTime };
  }

  // Same calendar day → "Friday, May 30 · 7:00 PM – 10:00 PM"
  const sameDay =
    startD.getFullYear() === endD.getFullYear() &&
    startD.getMonth() === endD.getMonth() &&
    startD.getDate() === endD.getDate();
  if (sameDay) {
    return {
      primary: sDate,
      secondary: `${sTime} – ${timeFmt.format(endD)}`,
    };
  }
  return {
    primary: `${sDate}, ${sTime}`,
    secondary: `Until ${dateFmt.format(endD)}, ${timeFmt.format(endD)}`,
  };
}

// 2-column image grid identical to the feed card, but without the 2-row cap.
// Tapping an image opens it fullscreen (swipeable across all the post's images).
function ImageGrid({ images }) {
  const viewer = useImageViewer();
  if (images.length === 0) return null;
  const items = images.map(attItem);
  if (images.length === 1) {
    return (
      <Pressable onPress={() => viewer?.open(items, 0)}>
        <Image
          source={{ uri: attUrl(images[0]) }}
          className="w-full mb-3 bg-base-200"
          style={{ aspectRatio: imageDisplayRatio(images[0]) }}
          resizeMode="cover"
        />
      </Pressable>
    );
  }
  return (
    <View className="flex-row flex-wrap mb-2" style={{ gap: 4 }}>
      {images.map((img, i) => {
        const lastOdd = images.length % 2 === 1 && i === images.length - 1;
        return (
          <Pressable
            key={`${attUrl(img)}-${i}`}
            onPress={() => viewer?.open(items, i)}
            style={{ width: lastOdd ? "100%" : "49%" }}
          >
            <Image
              source={{ uri: attUrl(img) }}
              className="w-full h-48 bg-base-200"
              resizeMode="cover"
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function MediaAttachments({ attachments }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const images = attachments.filter((a) => attachmentKind(a) === "image");
  const others = attachments.filter((a) => attachmentKind(a) !== "image");
  return (
    <View>
      <ImageGrid images={images} />
      {others.map((att, i) => {
        const kind = attachmentKind(att);
        const key = `${att.url}-${i}`;
        if (kind === "video") return <VideoAttachment key={key} att={att} />;
        return <AudioAttachment key={key} att={att} />;
      })}
    </View>
  );
}

export function PostBody({ post, typography }) {
  const viewer = useImageViewer();
  const title = post?.title || post?.name;
  const html = post?.body || "";
  const fonts = typography?.fonts;
  const fontSize = typography?.fontSize ?? 17;
  const lineHeight = typography?.lineHeight;

  const type = post?.type;
  const eventRange = type === "Event" ? formatEventRange(post) : null;
  const hero =
    type === "Media"
      ? null
      : post?.featuredImage || (type === "Link" ? post?.image : null);

  function openHref() {
    // A Link post that points at any Kowloon object opens in-app, not the browser.
    if (post?.href) openKowloonLink(post.href);
  }

  const hasLocation = !!post?.location?.name;
  const locationProminent = type === "Event";

  return (
    <View>
      {/* Title — Link gets its own treatment (external link, with host below) */}
      {type === "Link" ? (
        <>
          {title ? (
            <Pressable onPress={openHref}>
              <Text className="font-ui text-3xl text-post-link leading-tight mb-2">
                {title}
              </Text>
            </Pressable>
          ) : null}
          {post?.href ? (
            <Pressable onPress={openHref}>
              <Text className="font-ui uppercase tracking-[0.18em] text-xs text-base-content/55 mb-2">
                {hostOf(post.href)}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : title ? (
        <Text className="font-ui text-3xl text-base-content leading-tight mb-3">
          {title}
        </Text>
      ) : null}

      {/* Location — below the title (Article/Media/Link), prominent for Events,
          and between author row + body for Notes (which have no title). */}
      {hasLocation ? (
        <LocationLine
          location={post.location}
          prominent={locationProminent}
          className={locationProminent ? "mb-4" : "mb-3"}
        />
      ) : null}

      {/* Event details — date/time block. */}
      {type === "Event" && eventRange ? (
        <View className="  pl-4 mb-5">
          <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/55 mb-1">
            When
          </Text>
          <Text className="font-ui text-lg font-bold text-base-content leading-snug">
            {eventRange.primary}
          </Text>
          {eventRange.secondary ? (
            <Text className="font-ui text-base text-base-content/75 leading-snug mt-0.5">
              {eventRange.secondary}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Hero image — Article, Event, or Link. Media uses the attachment
          gallery as its content. On Link posts the image is part of the
          clickable external surface (matching the title + host). */}
      {hero ? (
        type === "Link" && post?.href ? (
          <Pressable onPress={openHref}>
            <Image
              source={{ uri: hero }}
              className="w-full h-72 mb-5   bg-base-200"
              resizeMode="cover"
            />
          </Pressable>
        ) : (
          <Pressable onPress={() => viewer?.open([hero], 0)}>
            <Image
              source={{ uri: hero }}
              className="w-full h-72 mb-5 bg-base-200"
              resizeMode="cover"
            />
          </Pressable>
        )
      ) : null}

      {/* Media gallery */}
      {type === "Media" ? (
        <View className="mb-3">
          <MediaAttachments attachments={post?.attachments} />
        </View>
      ) : null}

      {/* Body */}
      {html ? (
        <HtmlContent
          html={html}
          fonts={fonts}
          fontSize={fontSize}
          lineHeight={lineHeight}
          selectable
        />
      ) : !title ? (
        <Text className="font-ui text-base text-base-content/50">
          No content.
        </Text>
      ) : null}

      {/* Non-Media attachments (Articles/Events occasionally ship with a
          downloadable file). Audio/video render inline; images get the
          grid treatment. */}
      {type !== "Media" && Array.isArray(post?.attachments) && post.attachments.length > 0 ? (
        <View className="mt-4">
          <MediaAttachments attachments={post.attachments} />
        </View>
      ) : null}
    </View>
  );
}
