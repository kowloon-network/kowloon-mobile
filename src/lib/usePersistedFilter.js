// Feed filter state, account-scoped: the *current* view/types (ephemeral this
// session) plus the persisted *default* the feed opens to.
//
// The feed hydrates to the saved default, and the user can then change the view
// or type filter freely without disturbing it. Only an explicit "set as
// default" (saveDefaultView / saveDefaultTypes) writes the default — locally
// here, and to server prefs by the caller. The two axes are independent.
//
// `fallbackDefaults` (optional): used only on first hydration when AsyncStorage
// has no entry yet for this account — typically the user's server-side prefs so
// a fresh device lands on their saved default.

import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HARD_DEFAULTS = { viewKey: "all", activeTypes: [] };

function keyFor(accountId) {
  return accountId ? `kowloon:${accountId}:feedFilter` : null;
}

function fallbackHasValues(f) {
  return !!(
    f &&
    ((typeof f.viewKey === "string" && f.viewKey) ||
      (Array.isArray(f.activeTypes) && f.activeTypes.length))
  );
}

export function usePersistedFilter(accountId, fallbackDefaults) {
  // Which storageKey we've finished hydrating for. Derived (not a boolean set
  // in an effect) so `hydrated` is false on the very render an account switch
  // happens -- otherwise the feed saw hydrated=true with the PREVIOUS
  // account's viewKey for one render and fetched it.
  const [hydratedKey, setHydratedKey] = useState(undefined);
  // Current (ephemeral) selection.
  const [viewKey, setViewKey] = useState(HARD_DEFAULTS.viewKey);
  const [activeTypes, setActiveTypes] = useState(HARD_DEFAULTS.activeTypes);
  // Persisted default the feed opens to.
  const [defaultView, setDefaultView] = useState(HARD_DEFAULTS.viewKey);
  const [defaultTypes, setDefaultTypes] = useState(HARD_DEFAULTS.activeTypes);

  const storageKey = keyFor(accountId);
  const hydrated = hydratedKey === storageKey;
  const awaitingFallback = useRef(false);

  // Apply a default to BOTH the default and the current selection (used on
  // hydration — the feed opens to its default).
  function applyDefault(v, t) {
    if (typeof v === "string" && v) {
      setViewKey(v);
      setDefaultView(v);
    }
    if (Array.isArray(t)) {
      setActiveTypes(t);
      setDefaultTypes(t);
    }
  }

  // Hydrate on account change.
  useEffect(() => {
    // Start each account from the hard defaults so a view that only exists
    // for the previous account (e.g. its circle) never carries over.
    applyDefault(HARD_DEFAULTS.viewKey, HARD_DEFAULTS.activeTypes);
    if (!storageKey) {
      setHydratedKey(storageKey);
      return;
    }
    let cancelled = false;
    awaitingFallback.current = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          applyDefault(
            typeof parsed.viewKey === "string" ? parsed.viewKey : undefined,
            Array.isArray(parsed.activeTypes) ? parsed.activeTypes : undefined
          );
        } else if (fallbackHasValues(fallbackDefaults)) {
          applyDefault(fallbackDefaults.viewKey, fallbackDefaults.activeTypes);
        } else {
          // Storage empty, no fallback yet — apply it when it arrives.
          awaitingFallback.current = true;
        }
      } catch {
        // ignore — fall back to hard defaults
      }
      if (!cancelled) setHydratedKey(storageKey);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Late-arriving fallback (server prefs loaded after the storage read).
  const fallbackSig = JSON.stringify(fallbackDefaults || null);
  useEffect(() => {
    if (!awaitingFallback.current) return;
    if (fallbackHasValues(fallbackDefaults)) {
      applyDefault(fallbackDefaults.viewKey, fallbackDefaults.activeTypes);
      awaitingFallback.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackSig]);

  function persistDefault(next) {
    if (!storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
  }

  // Save the current view as the default (leaves the type-filter default alone).
  function saveDefaultView() {
    setDefaultView(viewKey);
    persistDefault({ viewKey, activeTypes: defaultTypes });
    return viewKey;
  }

  // Save the current type filter as the default (leaves the view default alone).
  function saveDefaultTypes() {
    setDefaultTypes(activeTypes);
    persistDefault({ viewKey: defaultView, activeTypes });
    return activeTypes;
  }

  function toggleType(type) {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function clearTypes() {
    setActiveTypes([]);
  }

  return {
    hydrated,
    viewKey,
    setViewKey,
    activeTypes,
    setActiveTypes,
    defaultView,
    defaultTypes,
    saveDefaultView,
    saveDefaultTypes,
    toggleType,
    clearTypes,
  };
}
