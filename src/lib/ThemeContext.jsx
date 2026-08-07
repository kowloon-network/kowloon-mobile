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
import { colorScheme } from "nativewind";

const KEY = "kowloon.themePref";
const VALID = new Set(["light", "dark", "system"]);

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
