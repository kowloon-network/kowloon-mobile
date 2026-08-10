// Theme-aware post-type color. POST_TYPES[t].color is light-only (a JS value),
// so icon tints / picker underlines wouldn't brighten in dark like the Tailwind
// `post-*` classes do. This hook returns (type) => hex for the CURRENT scheme,
// straight from the shared palette (@kowloon/client/theme/palette.json).
import { useColorScheme } from "nativewind";
import palette from "@kowloon/client/theme/palette.json";

const KEY = {
  Note: "post-note",
  Article: "post-article",
  Media: "post-media",
  Link: "post-link",
  Event: "post-event",
};

export function usePostColor() {
  const { colorScheme } = useColorScheme();
  const p = colorScheme === "dark" ? palette.dark : palette.light;
  return (type) => p[KEY[type]] ?? p["post-note"];
}
