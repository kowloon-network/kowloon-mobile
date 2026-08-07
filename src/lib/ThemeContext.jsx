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

const KEY = "kowloon.themePref";
const VALID = new Set(["light", "dark", "system"]);

// Theme token values applied via vars() on a wrapper View (see app/_layout.js).
// This is the reliable way to swap CSS variables in NativeWind/RN — a `.dark:root`
// CSS selector does not take effect because there is no real :root/DOM. Keep
// these in sync with the fallbacks in global.css.
export const THEME_VARS = {
  light: vars({
    "--color-base-100": "255 255 255",
    "--color-base-200": "244 244 244",
    "--color-base-300": "231 231 231",
    "--color-base-content": "26 26 32",
    "--color-field": "252 251 247",
  }),
  dark: vars({
    "--color-base-100": "21 22 26",
    "--color-base-200": "30 32 39",
    "--color-base-300": "46 49 58",
    "--color-base-content": "233 233 236",
    "--color-field": "30 32 39",
  }),
};

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
