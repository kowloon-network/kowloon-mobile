// Post type metadata — labels + colors. Each color is used for the icon tint,
// the picker underline, and the feed card accent. Colors come from the shared
// palette (@kowloon/client/theme/palette.json) — light values here; the Tailwind
// `post-*` classes carry the dark-mode variants.
import palette from "@kowloon/client/theme/palette.json";

const P = palette.light;

export const POST_TYPES = {
  Note: { label: "Note", color: P["post-note"] },
  Article: { label: "Article", color: P["post-article"] },
  Media: { label: "Media", color: P["post-media"] },
  Link: { label: "Link", color: P["post-link"] },
  Event: { label: "Event", color: P["post-event"] },
};

export const POST_TYPE_NAMES = ["Note", "Article", "Media", "Link", "Event"];

export const COMPOSABLE_TYPES = ["Note", "Article", "Link", "Media", "Event"];
