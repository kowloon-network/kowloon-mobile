import { Image } from "react-native";

import { usePostColor } from "../../lib/usePostColor.js";

// Monochrome line-art icons rasterized from the web frontend's SVGs. They're
// black on transparent, so `tintColor` recolors them to any type color.
const ICONS = {
  Note: require("../../../assets/post-icons/post-note.png"),
  Article: require("../../../assets/post-icons/post-article.png"),
  Media: require("../../../assets/post-icons/post-media.png"),
  Link: require("../../../assets/post-icons/post-link.png"),
  Event: require("../../../assets/post-icons/post-event.png"),
};

// Post type icon, tinted. Pass an explicit `color` to override the type's
// canonical color (e.g. a muted tint for an inactive picker item).
export function PostTypeIcon({ type, size = 24, color }) {
  const postColor = usePostColor();
  const src = ICONS[type];
  if (!src) return null;
  const tint = color || postColor(type);
  return (
    <Image
      source={src}
      style={{ width: size, height: size, tintColor: tint }}
      resizeMode="contain"
    />
  );
}
