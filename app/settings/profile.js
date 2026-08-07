// Profile editing screen.
// Fields: avatar, display name, bio, pronouns, up to 3 URLs.
// Submits via client.activities.updateProfile() and patches the Redux
// account store so the feed header updates immediately without a re-login.

import { useState } from "react";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { Avatar } from "../../src/components/posts/Avatar.jsx";
import { Eyebrow, Heading } from "../../src/components/ui/Heading.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { Button } from "../../src/components/ui/Button.jsx";
import { LocationField } from "../../src/components/posts/LocationField.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useInk } from "../../src/lib/useInk.js";
import {
  selectActiveAccount,
  updateAccountAndPersist,
} from "../../src/state/accountsSlice.js";
import { uploadFile } from "../../src/lib/uploadFile.js";
import { resolveImageUrl } from "../../src/lib/resolveImageUrl.js";

function Field({ label, children }) {
  return (
    <View className="mb-5">
      <Text className="font-ui text-xs font-semibold tracking-widest uppercase text-base-content/50 mb-1.5">
        {label}
      </Text>
      {children}
    </View>
  );
}

const INPUT_CLASS =
  "  bg-field px-3 py-2.5 font-ui text-base text-base-content";

export default function ProfileSettings() {
  const router = useRouter();
  const dispatch = useDispatch();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const ink = useInk();

  const profile = account?.profile || {};

  const [displayName, setDisplayName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.description || "");
  const [pronouns, setPronouns] = useState(profile.pronouns || "");
  const [urls, setUrls] = useState(profile.urls || []);
  const [urlInput, setUrlInput] = useState("");

  // Location — the schema stores a GeoPoint ({ name, type:"Point",
  // coordinates:[lon,lat] }); LocationField works in { name, lat, lon }.
  const [location, setLocation] = useState(() => {
    const loc = profile.location;
    if (Array.isArray(loc?.coordinates) && loc.coordinates.length === 2) {
      return { name: loc.name || "", lon: loc.coordinates[0], lat: loc.coordinates[1] };
    }
    return null;
  });

  // avatarPick / featuredPick — local uri to display + upload on save; null = no change
  const [avatarPick, setAvatarPick] = useState(null);
  const [featuredPick, setFeaturedPick] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function pickAvatar() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setAvatarPick({
        uri: asset.uri,
        name: asset.fileName || `avatar-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
    } catch (e) {
      setError(e?.message || "Couldn't open the photo library.");
    }
  }

  async function pickFeatured() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 1],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setFeaturedPick({
        uri: asset.uri,
        name: asset.fileName || `cover-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
    } catch (e) {
      setError(e?.message || "Couldn't open the photo library.");
    }
  }

  function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed || urls.includes(trimmed) || urls.length >= 3) return;
    setUrls([...urls, trimmed]);
    setUrlInput("");
  }

  function removeUrl(url) {
    setUrls(urls.filter((u) => u !== url));
  }

  async function save() {
    if (!client || !account) return;
    setSaving(true);
    setError(null);
    try {
      let iconUrl = profile.icon;

      if (avatarPick) {
        const upload = await uploadFile(client, {
          uri: avatarPick.uri,
          name: avatarPick.name,
          mimeType: avatarPick.mimeType,
          to: "@public",
          generateThumbnail: true,
          thumbnailSizes: [200],
        });
        iconUrl = upload?.file?.url || iconUrl;
      }

      let featuredUrl = profile.featuredImage;
      if (featuredPick) {
        const upload = await uploadFile(client, {
          uri: featuredPick.uri,
          name: featuredPick.name,
          mimeType: featuredPick.mimeType,
          to: "@public",
          generateThumbnail: true,
        });
        featuredUrl = upload?.file?.url || featuredUrl;
      }

      // Flush a URL that was typed but not yet "+"-added — otherwise a link the
      // user clearly intended to save is silently dropped.
      let finalUrls = urls;
      const pendingUrl = urlInput.trim();
      if (pendingUrl && !finalUrls.includes(pendingUrl) && finalUrls.length < 3) {
        finalUrls = [...finalUrls, pendingUrl];
      }

      // Location — send the GeoPoint shape the schema expects (Update, unlike
      // Create, doesn't normalize), or null to clear.
      const locationPayload =
        location && Number.isFinite(location.lat) && Number.isFinite(location.lon)
          ? {
              name: location.name || "",
              type: "Point",
              coordinates: [location.lon, location.lat],
            }
          : null;

      await client.activities.updateProfile({
        profile: {
          name: displayName.trim(),
          description: bio.trim(),
          pronouns: pronouns.trim(),
          urls: finalUrls,
          icon: iconUrl,
          featuredImage: featuredUrl,
          location: locationPayload,
        },
      });

      await dispatch(
        updateAccountAndPersist(account.id, {
          profile: {
            ...profile,
            name: displayName.trim(),
            description: bio.trim(),
            pronouns: pronouns.trim(),
            urls: finalUrls,
            icon: iconUrl,
            featuredImage: featuredUrl,
            location: locationPayload,
          },
        })
      );

      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't save profile.");
    } finally {
      setSaving(false);
    }
  }

  const avatarActor = {
    name: displayName || profile.name,
    icon: avatarPick?.uri || profile.icon,
  };

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right", "bottom"]}>
      <AppHeader back title="Edit Profile" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-6">
            {/* Avatar */}
            <Field label="Avatar">
              <View className="flex-row items-center gap-4">
                <Avatar actor={avatarActor} size={72} baseUrl={account?.baseUrl} />
                <Pressable
                  onPress={pickAvatar}
                  className="  px-4 py-2"
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                >
                  <Text className="font-ui text-xs uppercase tracking-widest text-base-content">
                    Change photo
                  </Text>
                </Pressable>
              </View>
            </Field>

            {/* Cover image */}
            <Field label="Cover image">
              {(() => {
                const src =
                  featuredPick?.uri ||
                  resolveImageUrl(profile.featuredImage, account?.baseUrl);
                return src ? (
                  <View>
                    <Image
                      source={{ uri: src }}
                      style={{ width: "100%", aspectRatio: 3 }}
                      className="  bg-base-200"
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={pickFeatured}
                      className="  px-4 py-2 mt-2 self-start"
                      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                    >
                      <Text className="font-ui text-xs uppercase tracking-widest text-base-content">
                        Change cover
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={pickFeatured}
                    className="  bg-field items-center justify-center"
                    style={{ width: "100%", aspectRatio: 3 }}
                    android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                  >
                    <Text className="font-ui text-xs uppercase tracking-widest text-base-content/55">
                      + Add cover image
                    </Text>
                  </Pressable>
                );
              })()}
            </Field>

            {/* Display name */}
            <Field label="Display name">
              <TextInput
                className={INPUT_CLASS}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={ink(0.35)}
                autoCorrect={false}
              />
            </Field>

            {/* Bio */}
            <Field label="Bio">
              <TextInput
                className={INPUT_CLASS}
                value={bio}
                onChangeText={setBio}
                placeholder="A little about yourself…"
                placeholderTextColor={ink(0.35)}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
            </Field>

            {/* Pronouns */}
            <Field label="Pronouns">
              <TextInput
                className={INPUT_CLASS}
                value={pronouns}
                onChangeText={setPronouns}
                placeholder="e.g. they/them"
                placeholderTextColor={ink(0.35)}
                autoCorrect={false}
              />
            </Field>

            {/* Location */}
            <Field label="Location">
              <LocationField value={location} onChange={setLocation} />
            </Field>

            {/* URLs */}
            <Field label={`Links (${urls.length}/3)`}>
              {urls.map((url) => (
                <View
                  key={url}
                  className="flex-row items-center   bg-base-100 px-3 mb-2"
                >
                  <Text
                    className="flex-1 font-ui text-sm text-base-content py-2.5"
                    numberOfLines={1}
                  >
                    {url}
                  </Text>
                  <Pressable onPress={() => removeUrl(url)} hitSlop={8}>
                    <Text className="font-ui text-base text-base-content/40 pl-3">
                      ×
                    </Text>
                  </Pressable>
                </View>
              ))}
              {urls.length < 3 && (
                <View className="flex-row gap-2">
                  <TextInput
                    className={`${INPUT_CLASS} flex-1`}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    onSubmitEditing={addUrl}
                    placeholder="https://example.com"
                    placeholderTextColor={ink(0.35)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={addUrl}
                    className="  px-3 items-center justify-center"
                    android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  >
                    <Text className="font-ui text-xl text-base-content leading-none">
                      +
                    </Text>
                  </Pressable>
                </View>
              )}
            </Field>

            {/* App & Kowloon preferences live on their own screen. */}
            <Pressable
              onPress={() => router.push("/settings/preferences")}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              className="mt-4 py-4 flex-row items-center justify-between border-t border-base-200"
            >
              <View className="flex-1 pr-3">
                <Text className="font-ui text-base text-base-content">
                  Preferences
                </Text>
                <Text className="font-ui text-xs text-base-content/50 mt-0.5">
                  Composing, feed, notifications, time zone
                </Text>
              </View>
              <Text className="font-ui text-lg text-base-content/40">›</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Sticky footer — always visible above keyboard */}
        <View className="px-6 pt-3 pb-2 bg-base-100  ">
          {error ? (
            <Text className="font-ui text-sm text-error mb-3">{error}</Text>
          ) : null}
          <Pressable
            onPress={save}
            disabled={saving}
            className="bg-primary items-center justify-center h-12 mb-3"
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            {saving ? (
              <ActivityIndicator color="#FAF4E8" />
            ) : (
              <Text className="font-ui uppercase tracking-[0.14em] text-sm text-primary-content">
                Save
              </Text>
            )}
          </Pressable>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
