// Theme preference (#33): Light / Dark / Auto (follow system). Device-local
// (AsyncStorage), NOT account-synced — dark mode is a per-device choice. Drives
// NativeWind's colorScheme, which toggles the `dark` class the token variables
// in global.css key off of.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme, vars } from "nativewind";
import palette from "@kowloon/client/theme/palette.json";

const KEY = "kowloon.themePref";
const VALID = new Set(["light", "dark", "system"]);

// The variable-driven tokens (must match the `v(...)` set in tailwind.config.js).
// Their light/dark values come from the shared palette and are applied via
// vars() on a wrapper View (app/_layout.js) — the reliable way to swap CSS
// variables in NativeWind/RN (a `.dark:root` CSS selector has no effect, since
// there's no real :root/DOM).
const VAR_TOKENS = [
  "base-100",
  "base-200",
  "base-300",
  "base-content",
  "field",
  "primary-content",
  "neutral",
  "post-note",
  "post-article",
  "post-media",
  "post-link",
  "post-event",
];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}

function themeVars(mode) {
  const m = palette[mode];
  const out = {};
  for (const t of VAR_TOKENS) out[`--color-${t}`] = hexToRgb(m[t]);
  return vars(out);
}

export const THEME_VARS = { light: themeVars("light"), dark: themeVars("dark") };

const ThemeContext = createContext({ pref: "system", setPref: () => {} });

export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState("system");

  // Hydrate the saved pref once, then apply it.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        const p = VALID.has(v) ? v : "system";
        if (cancelled) return;
        setPrefState(p);
        colorScheme.set(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setPref = useCallback((p) => {
    if (!VALID.has(p)) return;
    setPrefState(p);
    colorScheme.set(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ pref, setPref }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
