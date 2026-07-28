// Preferences — a generic control panel rendered from the shared pref manifest
// (@kowloon/client). Each entry's `type` picks a control; values are read/written
// flat on user.prefs. Writes go straight to the server via updateProfile:
//   - scalar prefs merge (the Update handler dot-paths prefs.<key>)
//   - nested `notifications.*` must be sent as the WHOLE object, since the
//     handler replaces prefs.notifications wholesale.
// Reading typography has its own dedicated screen and is linked, not inlined.

import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { PREFS, PREF_GROUPS, getPrefValue } from "@kowloon/client";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { AudienceSelector } from "../../src/components/posts/AudienceSelector.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";

export default function PreferencesScreen() {
  const client = useActiveClient();
  const router = useRouter();
  const [prefs, setPrefs] = useState(() => ({
    ...(client?.auth?.getUser?.()?.prefs || {}),
  }));

  const writePref = useCallback(
    (key, value) => {
      let nextPrefs;
      let payload;
      if (key.startsWith("notifications.")) {
        const sub = key.slice("notifications.".length);
        const nextNotifs = { ...(prefs.notifications || {}), [sub]: value };
        nextPrefs = { ...prefs, notifications: nextNotifs };
        payload = { notifications: nextNotifs }; // send the whole nested object
      } else {
        nextPrefs = { ...prefs, [key]: value };
        payload = { [key]: value };
      }
      setPrefs(nextPrefs);
      // Keep the client's cached user fresh so other screens read the new value
      // this session (the server is the source of truth on next launch).
      const u = client?.auth?.getUser?.();
      if (u) u.prefs = nextPrefs;
      client?.activities
        ?.updateProfile?.({ updates: { prefs: payload } })
        .catch(() => {});
    },
    [prefs, client]
  );

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["top"]}>
      <AppHeader back title="Preferences" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {PREF_GROUPS.map((group) => {
          const entries = PREFS.filter((p) => p.group === group.key);
          if (!entries.length) return null;
          return (
            <View key={group.key} className="mt-5">
              <Text className="font-ui uppercase tracking-[0.14em] text-xs text-base-content/55 px-4 pb-2">
                {group.label}
              </Text>
              <View className="bg-white">
                {entries.map((entry) => (
                  <PrefControl
                    key={entry.key}
                    entry={entry}
                    value={getPrefValue(prefs, entry)}
                    onChange={(v) => writePref(entry.key, v)}
                  />
                ))}
              </View>
            </View>
          );
        })}

        {/* Reading typography — its own screen (live preview + typeface picker). */}
        <View className="mt-5">
          <Text className="font-ui uppercase tracking-[0.14em] text-xs text-base-content/55 px-4 pb-2">
            Reading
          </Text>
          <Pressable
            onPress={() => router.push("/settings/typography")}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            className="bg-white px-4 py-4 flex-row items-center justify-between"
          >
            <Text className="font-ui text-base text-base-content">
              Reading typography
            </Text>
            <Text className="font-ui text-lg text-base-content/40">›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrefControl({ entry, value, onChange }) {
  switch (entry.type) {
    case "toggle":
      return (
        <RowH entry={entry}>
          <Switch value={!!value} onValueChange={onChange} />
        </RowH>
      );
    case "select":
      return (
        <RowV entry={entry}>
          <View className="flex-row flex-wrap">
            {entry.options.map((o) => (
              <Pill
                key={o.value}
                label={o.label}
                active={value === o.value}
                onPress={() => onChange(o.value)}
              />
            ))}
          </View>
        </RowV>
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <RowV entry={entry}>
          <View className="flex-row flex-wrap">
            {entry.options.map((o) => {
              const active = arr.includes(o.value);
              return (
                <Pill
                  key={o.value}
                  label={o.label}
                  active={active}
                  onPress={() => {
                    const next = active
                      ? arr.filter((x) => x !== o.value)
                      : [...arr, o.value];
                    // Never allow an empty filter — keep at least one type.
                    if (next.length) onChange(next);
                  }}
                />
              );
            })}
          </View>
        </RowV>
      );
    }
    case "audience":
      return (
        <View className="px-4 py-3 border-b border-base-200">
          {entry.hint ? (
            <Text className="font-ui text-xs text-base-content/50 mb-2">
              {entry.hint}
            </Text>
          ) : null}
          <AudienceSelector
            value={value}
            onChange={onChange}
            label={entry.label}
            allowPrivate
          />
        </View>
      );
    default:
      return null;
  }
}

// Horizontal row: label (+hint) left, control right.
function RowH({ entry, children }) {
  return (
    <View className="px-4 py-3 border-b border-base-200 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="font-ui text-base text-base-content">{entry.label}</Text>
        {entry.hint ? (
          <Text className="font-ui text-xs text-base-content/50 mt-0.5">
            {entry.hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// Vertical row: label (+hint) on top, control below.
function RowV({ entry, children }) {
  return (
    <View className="px-4 py-3 border-b border-base-200">
      <Text className="font-ui text-base text-base-content mb-0.5">
        {entry.label}
      </Text>
      {entry.hint ? (
        <Text className="font-ui text-xs text-base-content/50 mb-2">
          {entry.hint}
        </Text>
      ) : (
        <View className="mb-2" />
      )}
      {children}
    </View>
  );
}

function Pill({ label, active, onPress }) {
  // Colors via inline style, not NativeWind classes: a conditional `className`
  // background doesn't reliably repaint on Android (same reason the feed filter
  // toggles icon COLOR, not a background). Inline color values always re-apply.
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      className="mr-2 mb-1"
    >
      {/* key flips with `active` so the View remounts on toggle — guarantees a
          background repaint even where in-place restyle is unreliable. */}
      <View
        key={active ? "on" : "off"}
        className="px-3 py-2"
        style={{ backgroundColor: active ? "#5588B1" : "#F4F4F4" }}
      >
        <Text
          className="font-ui text-sm"
          style={{ color: active ? "#F4F5F7" : "#1A1A20" }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
