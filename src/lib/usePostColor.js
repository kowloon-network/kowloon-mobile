// Theme-aware post-type color. POST_TYPES[t].color is light-only (a JS value),
// so icon tints / picker underlines wouldn't brighten in dark like the Tailwind
// `post-*` classes do. This hook returns (type) => hex for the CURRENT scheme,
// straight from the shared palette (@kowloon/design/tokens/palette.json).
import { useColorScheme } from "nativewind";
import palette from "@kowloon/design/tokens/palette.json";

const KEY = {
  Note: "post-note",
  Article: "post-article",
  Media: "post-media",
  Link: "post-link",
  Event: "post-event",
};

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Second arg is optional -- omit for the full-opacity hex, pass an alpha
// (0-1) to get the same type color faded (e.g. TypeFilter's inactive
// state), rather than falling back to a neutral ink tint that drops the
// type's own hue entirely.
export function usePostColor() {
  const { colorScheme } = useColorScheme();
  const p = colorScheme === "dark" ? palette.dark : palette.light;
  return (type, alpha) => {
    const hex = p[KEY[type]] ?? p["post-note"];
    return alpha == null ? hex : hexToRgba(hex, alpha);
  };
}
