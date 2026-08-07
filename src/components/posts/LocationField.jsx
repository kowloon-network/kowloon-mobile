// LocationField — universal location picker for the composer.
//
// Chip-style trigger:
//   no location:  "+ Add location"
//   location set: "📍 <place name>"   (tap the × to clear)
//
// Tap → bottom sheet with:
//   - "Use current location" (GPS via expo-location → reverse-geocode)
//   - Search input + live debounced Nominatim results
//
// Value shape (passed up via onChange and sent to createPost as `location`):
//   { name, lat, lon }   — server normalizes to GeoPoint at Create-handler time.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { placeLabel, reverseLookup, searchPlaces } from "../../lib/geocode.js";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { useInk } from "../../lib/useInk.js";

const SEARCH_DEBOUNCE_MS = 400;

export function LocationField({ value, onChange }) {
  const ink = useInk();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);

  // Modal lives in its own window on Android, so KeyboardAvoidingView can't
  // see it. Apply the measured keyboard inset as bottom padding instead.
  const { keyboardInset } = useKeyboardInset();

  // Reset transient state when the sheet closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  // Debounced forward geocoding.
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchPlaces(query.trim());
        setResults(data);
      } catch (e) {
        setError(e?.message || "Search failed.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  async function useCurrentLocation() {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      let name = "Current location";
      try {
        const r = await reverseLookup({ lat: latitude, lon: longitude });
        name = placeLabel(r) || name;
      } catch {
        // Reverse lookup is best-effort — fall back to the placeholder name.
      }
      onChange({ name, lat: latitude, lon: longitude });
      setOpen(false);
    } catch (e) {
      setError(e?.message || "Couldn't get your current location.");
    } finally {
      setLocating(false);
    }
  }

  function selectResult(r) {
    const name = placeLabel(r);
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    onChange({ name, lat, lon });
    setOpen(false);
  }

  function clearLocation(e) {
    e?.stopPropagation?.();
    onChange(null);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
        className="flex-row items-center   bg-base-100 px-3 py-2"
      >
        <Text className="font-ui text-sm mr-2 text-base-content/70">📍</Text>
        {value ? (
          <>
            <Text
              className="font-ui text-xs uppercase tracking-[0.12em] text-base-content flex-1"
              numberOfLines={1}
            >
              {value.name}
            </Text>
            <Pressable
              onPress={clearLocation}
              hitSlop={8}
              className="ml-2 px-1"
            >
              <Text className="font-ui text-base-content/45 text-sm">×</Text>
            </Pressable>
          </>
        ) : (
          <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/55 flex-1">
            Add location
          </Text>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        {/* Backdrop is a sibling absolute layer, not a parent — keeps
            keyboard-dismiss taps from registering on it and tearing the
            sheet down with them. */}
        <View className="flex-1 justify-end" style={{ paddingBottom: keyboardInset }}>
          <Pressable
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
            className="bg-black/40"
          />
          <SafeAreaView
            edges={keyboardInset > 0 ? [] : ["bottom"]}
            className="bg-base-100"
          >
            <View className=" ">
              <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 px-5 pt-4 pb-2">
                Location
              </Text>

              <Pressable
                onPress={useCurrentLocation}
                disabled={locating}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className="flex-row items-center px-5 py-3  "
              >
                {locating ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-ui text-lg mr-3">📍</Text>
                )}
                <Text className="font-ui text-base text-base-content flex-1 ml-1">
                  Use current location
                </Text>
              </Pressable>

              <View className="px-5 pt-3 pb-2">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search for a place"
                  placeholderTextColor={ink(0.35)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  className="  bg-white px-3 py-2.5 font-ui text-base text-base-content"
                />
              </View>

              {error ? (
                <Text className="font-ui text-xs text-error px-5 pb-2">
                  {error}
                </Text>
              ) : null}

              <ScrollView
                keyboardShouldPersistTaps="handled"
                className="max-h-72"
              >
                {searching ? (
                  <View className="px-5 py-4 items-start">
                    <ActivityIndicator />
                  </View>
                ) : results.length === 0 && query.trim().length >= 2 ? (
                  <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/40 px-5 py-3">
                    No matches
                  </Text>
                ) : (
                  results.map((r, i) => {
                    const label = placeLabel(r) || r.display_name || "Unknown";
                    return (
                      <Pressable
                        key={`${r.place_id || r.osm_id || i}`}
                        onPress={() => selectResult(r)}
                        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                        className="px-5 py-3  "
                      >
                        <Text
                          className="font-ui text-base text-base-content"
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        {r.display_name && r.display_name !== label ? (
                          <Text
                            className="font-ui text-xs text-base-content/45 mt-0.5"
                            numberOfLines={1}
                          >
                            {r.display_name}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
