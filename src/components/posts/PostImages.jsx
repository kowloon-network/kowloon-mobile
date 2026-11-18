// PostImages -- how a post's photos are shaped and cropped.
//
// The rules live in @kowloon/client's imageLayout.js (shared with the web):
// each image keeps its own shape within limits (no taller than 4:5, no wider
// than 2.5:1; header images no taller than 5:4), several images sit in rows
// that keep their shapes, and any crop is anchored on the image's focus point
// so the subject stays in frame.
//
// Images whose size the server doesn't know (old uploads, some links) are
// measured when they load and re-laid out then.

import { useCallback, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import {
  layoutImageRows,
  naturalRatio,
  displayRatio,
  cropPositionPercent,
  FEED_IMAGE_LIMITS,
  HEADER_IMAGE_LIMITS,
} from "@kowloon/client";
import { SmartImage as Image } from "../ui/SmartImage.jsx";

const GAP = 4;

// Remember sizes measured at load time, keyed by URL.
function useMeasured() {
  const [sizes, setSizes] = useState({});
  const onMeasured = useCallback((uri, e) => {
    const w = e?.source?.width;
    const h = e?.source?.height;
    if (!uri || !w || !h) return;
    setSizes((prev) => (prev[uri] ? prev : { ...prev, [uri]: { width: w, height: h } }));
  }, []);
  return [sizes, onMeasured];
}

// Attachment (rich object or bare URL string) -> ImageRows item.
export function toLayoutItem(att, kind) {
  if (typeof att === "string") return { uri: att, kind };
  return {
    uri: att?.url || att?.href || "",
    kind,
    width: att?.width,
    height: att?.height,
    focus: att?.focus,
    alt: att?.alt || att?.summary || "",
  };
}

// items: [{ uri, kind: "image"|"video"|"audio", width, height, focus, alt }]
// onPressItem(index), renderOverlay(index) -> node (e.g. "+3 more").
// renderPlaceholder(item) -> node for non-image cells (video/audio icons).
export function ImageRows({ items, onPressItem, renderOverlay, renderPlaceholder, limits = FEED_IMAGE_LIMITS }) {
  const [sizes, onMeasured] = useMeasured();

  const sized = useMemo(
    () =>
      items.map((it) => {
        // Audio has no picture: give it a square tile.
        if (it.kind === "audio") return { ...it, width: 1, height: 1 };
        if (naturalRatio(it)) return it;
        return sizes[it.uri] ? { ...it, ...sizes[it.uri] } : it;
      }),
    [items, sizes]
  );
  const rows = useMemo(() => layoutImageRows(sized, { limits }), [sized, limits]);

  const lone = sized.length === 1 ? sized[0] : null;

  return (
    <View style={{ gap: GAP }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: GAP }}>
          {row.cells.map(({ index, ratio, position }, _j, cells) => {
            // flexGrow normalised to sum to 1: a total below 1 would leave
            // part of the row empty (flexbox only hands out that fraction).
            const grow = ratio / cells.reduce((sum, c) => sum + c.ratio, 0);
            const it = sized[index];
            const pos = {
              left: `${Math.round(position.x * 1000) / 10}%`,
              top: `${Math.round(position.y * 1000) / 10}%`,
            };
            return (
              <Pressable
                key={`${it.uri}-${index}`}
                onPress={onPressItem ? () => onPressItem(index) : undefined}
                accessibilityRole={it.kind === "image" ? "image" : "button"}
                accessibilityLabel={it.alt || undefined}
                style={{
                  flexGrow: grow,
                  flexBasis: 0,
                  aspectRatio: ratio,
                  // A small lone image isn't blown up past its own width.
                  ...(lone && lone.kind === "image" && lone.width > 1 ? { maxWidth: lone.width } : null),
                }}
              >
                <View className="w-full h-full bg-base-200 items-center justify-center overflow-hidden">
                  {it.kind === "image" ? (
                    <Image
                      source={{ uri: it.uri }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      contentPosition={pos}
                      onLoad={naturalRatio(items[index]) ? undefined : (e) => onMeasured(it.uri, e)}
                    />
                  ) : (
                    renderPlaceholder?.(it)
                  )}
                  {renderOverlay?.(index)}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// A single header image (Article/Note/Event/Link): keeps its shape between
// 5:4 and 2.5:1 by default, cropped around its focus point.
// info: { width, height, focus } -- the post's featuredImageInfo.
export function HeaderImage({ uri, info, onPress, limits = HEADER_IMAGE_LIMITS, className = "" }) {
  const [sizes, onMeasured] = useMeasured();
  const known = naturalRatio(info) ? info : sizes[uri];
  const ratio = displayRatio(known, limits);
  const pos = cropPositionPercent(naturalRatio(known), ratio, info?.focus);
  // The ratio sits on a wrapper: on SmartImage, a className replaces the
  // style prop, which would drop the aspectRatio and collapse the image.
  const image = (
    <View className={`w-full bg-base-200 overflow-hidden ${className}`} style={{ aspectRatio: ratio }}>
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        contentPosition={pos}
        onLoad={naturalRatio(info) ? undefined : (e) => onMeasured(uri, e)}
      />
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{image}</Pressable> : image;
}
