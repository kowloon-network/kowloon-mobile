// useInk (#33) — theme-aware foreground "ink" color for places that can't use a
// Tailwind class: lucide icon `color=` props, inline border/text styles, etc.
// Returns a function so callers keep their opacity: ink(0.45) -> the base-content
// color at 45% for the current color scheme. Replaces hardcoded
// rgba(26,26,32,a) tints, which stayed dark (illegible) in dark mode.
import { useColorScheme } from "nativewind";

const LIGHT_RGB = "26,26,32"; // #1A1A20
const DARK_RGB = "233,233,236"; // #E9E9EC

export function useInk() {
  const { colorScheme } = useColorScheme();
  const rgb = colorScheme === "dark" ? DARK_RGB : LIGHT_RGB;
  return (alpha = 1) => `rgba(${rgb},${alpha})`;
}
