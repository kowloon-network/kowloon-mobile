// PostActionBar — Reply / React / Repost / Share / Bookmark row.
//
// Used in two places:
//   - Timeline card  — Reply taps navigate to the post detail.
//   - Detail screen  — Reply scrolls to + focuses the composer.
//
// React uses the existing ReactButton (which carries the picker + optimistic
// count). The other actions take callbacks or do their own thing inline.

import { useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import {
  Bookmark,
  MessageCircle,
  Repeat2,
  Share2,
  Smile,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { ReactButton } from "./ReactButton.jsx";
import { BookmarkComposer } from "../bookmarks/BookmarkComposer.jsx";
import { PostMoreMenu } from "./PostMoreMenu.jsx";
import { useInk } from "../../lib/useInk.js";

const ICON_STROKE = 1.75;

function CountIcon({ Icon, count, onPress, label, size = "md", disabled }) {
  const ink = useInk();
  const iconSize = size === "sm" ? 16 : 20;
  const countSize = size === "sm" ? "text-[11px]" : "text-xs";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={8}
      android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
      className={`flex-row items-center ${disabled ? "opacity-30" : ""}`}
    >
      <Icon size={iconSize} color={ink(0.55)} strokeWidth={ICON_STROKE} />
      {typeof count === "number" && count > 0 ? (
        <Text className={`font-ui ${countSize} text-base-content/55 ml-1.5`}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

// Public posts are shareable to the OS; private ones aren't, so we render the
// share icon disabled with an explanatory alert on tap.
function isPublicPost(post) {
  return (
    post?.to === "@public" ||
    post?.to === "public" ||
    post?.visibility === "Public" ||
    post?.visibility === "public"
  );
}

// Audience tier of a post, for gating reshares (#47):
//   "public"     → @public: reshareable anywhere.
//   "server"     → @<domain>: reshareable only to Community (no wider).
//   "restricted" → a circle/group/self address: not reshareable at all.
function postAudienceTier(post) {
  if (isPublicPost(post)) return "public";
  const to = String(post?.to || "").trim();
  if (to.startsWith("circle:") || to.startsWith("group:")) return "restricted";
  // @user@domain (two @s) = addressed to a specific user (self / private).
  if (/^@[^@\s]+@[^@\s]+$/.test(to)) return "restricted";
  // @domain (single @, not @public) = server / community.
  if (/^@[a-z0-9.-]+$/i.test(to)) return "server";
  return "restricted"; // unknown addressing → fail closed
}

// Lightweight HTML strip for the repost-quote prefill. textPreview is usually
// already plain text, but the body/summary fallback might carry tags. Not a
// sanitizer — purely for plain-text excerpt extraction.
function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function postShareUrl(client, post) {
  // Use the post's canonical URL when present; otherwise fall back to a
  // kwln://post/<id> deep link the server can resolve. Always prefer the
  // public canonical link — that's what people send to friends.
  if (post?.url) return post.url;
  const baseUrl = client?.http?.baseUrl;
  const id = post?.id;
  if (!baseUrl || !id) return null;
  return `${baseUrl.replace(/\/$/, "")}/posts/${encodeURIComponent(id)}`;
}

// A bookmark needs a title, but Notes have none — derive a sensible one from
// the post we already hold rather than round-tripping through link-preview
// (which the SSRF guard blocks for local URLs anyway).
function deriveBookmarkTitle(post) {
  const explicit = post?.title || post?.name;
  if (explicit) return explicit;
  const text = (post?.textPreview || stripHtml(post?.summary || post?.body || "")).trim();
  if (text) {
    const firstLine = text.split("\n")[0].trim();
    return firstLine.length > 80
      ? firstLine.slice(0, 80).replace(/\s+\S*$/, "") + "…"
      : firstLine;
  }
  const author = post?.actor?.name || post?.actor?.id || "Unknown";
  return `Post by ${author}`;
}

// Seed the bookmark's notes with the original post's summary/excerpt as plain
// text — the user can edit before saving. Stored as Markdown source, rendered
// to the bookmark's body by the server.
function deriveBookmarkNotes(post) {
  const text =
    (post?.summary ? stripHtml(post.summary) : "") ||
    post?.textPreview ||
    stripHtml(post?.body || "");
  return text.trim() || undefined;
}

// Hero image, falling back to the first image attachment for Media posts.
function deriveBookmarkImage(post) {
  if (post?.featuredImage) return post.featuredImage;
  if (post?.image) return post.image;
  const firstImage = Array.isArray(post?.attachments)
    ? post.attachments.find((a) =>
        (a?.mediaType || "").toLowerCase().startsWith("image/")
      )
    : null;
  return firstImage?.url || undefined;
}

export function PostActionBar({
  post,
  client,
  currentUser,
  onReply,
  onReacted,
  onDeleted,
  size = "md",
  className = "",
}) {
  const router = useRouter();
  const [bookmarking, setBookmarking] = useState(false);
  const shareUrl = postShareUrl(client, post);
  const canShare = !!shareUrl && isPublicPost(post);

  function handleReply() {
    if (onReply) return onReply();
    if (post?.id) {
      router.push(`/post/${encodeURIComponent(post.id)}?focusReply=1`);
    }
  }

  function handleRepost() {
    if (!currentUser) return;
    if (!shareUrl) return;
    // A reshare can't leak a post to a wider audience than the original (#47).
    const tier = postAudienceTier(post);
    if (tier === "restricted") {
      Alert.alert(
        "Can't reshare",
        "This post was shared with a specific circle (or privately), so it can't be reshared."
      );
      return;
    }
    // Carry the original's identity into the new draft so the reshare uses
    // the same hero image and quotes the source — compose.js prefills these
    // from params (see Repost prefill block there).
    const title = post?.title || post?.name || "";
    const featuredImage = post?.featuredImage || post?.image || "";
    const quote = (post?.textPreview || stripHtml(post?.summary || post?.body || "")).trim();
    router.push({
      pathname: "/compose",
      params: {
        type: "Link",
        href: shareUrl,
        title,
        featuredImage,
        quote,
        // Community posts may only be reshared to Community — cap the audience
        // selector to the original's tier so it can't be widened to Public.
        ...(tier === "server" ? { constrain: post?.to } : {}),
      },
    });
  }


  async function handleShare() {
    if (!shareUrl) return;
    if (!isPublicPost(post)) {
      Alert.alert("Private post", "This post is private — it can't be shared.");
      return;
    }
    const title = post?.title || post?.name || "";
    try {
      await Share.share({
        url: shareUrl,
        message: title ? `${title}\n${shareUrl}` : shareUrl,
        title,
      });
    } catch {
      // user cancelled or sheet failed; no-op
    }
  }

  function handleBookmark() {
    if (!currentUser) return;
    setBookmarking(true);
  }

  const bookmarkInitial = {
    href: shareUrl || undefined,
    title: deriveBookmarkTitle(post),
    image: deriveBookmarkImage(post),
    notes: deriveBookmarkNotes(post),
  };

  return (
    <>
    <View className={`flex-row items-center ${className}`}>
      {/* Left group — equally spaced action icons */}
      <View
        className="flex-row items-center flex-1"
        style={{ gap: size === "sm" ? 20 : 24 }}
      >
        <CountIcon
          Icon={MessageCircle}
          count={post?.replyCount}
          onPress={handleReply}
          label="Reply"
          size={size}
        />

        {currentUser && post?.canReact !== "@none" && post?.canReact !== "none" ? (
          <ReactButton
            client={client}
            post={post}
            onReacted={onReacted}
            size={size}
          />
        ) : (
          <CountIcon
            Icon={Smile}
            count={post?.reactCount}
            onPress={() => {}}
            label="React"
            size={size}
            disabled
          />
        )}

        {currentUser ? (
          <CountIcon
            Icon={Repeat2}
            onPress={handleRepost}
            label="Repost"
            size={size}
            disabled={!shareUrl}
          />
        ) : null}

        <CountIcon
          Icon={Share2}
          onPress={handleShare}
          label="Share"
          size={size}
          disabled={!canShare}
        />

        {currentUser ? (
          <CountIcon
            Icon={Bookmark}
            onPress={handleBookmark}
            label="Bookmark"
            size={size}
          />
        ) : null}
      </View>

      {/* Ellipsis — flush right */}
      <PostMoreMenu
        post={post}
        client={client}
        currentUser={currentUser}
        onDeleted={onDeleted}
      />
    </View>

    {currentUser ? (
      <BookmarkComposer
        visible={bookmarking}
        onClose={() => setBookmarking(false)}
        initialValues={bookmarkInitial}
        client={client}
        currentUser={currentUser}
      />
    ) : null}
    </>
  );
}

