// GroupForm — shared create/edit form for groups.
//
// Fields: icon (pick + upload), name, summary, location, visibility
// (public / server / one of your circles), and RSVP policy. Parent owns the
// actual createGroup/updateGroup + icon upload; this form hands back
// { name, summary, location, to, rsvpPolicy, iconAsset, iconUrl }.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus } from "lucide-react-native";

import { BottomSheetPicker } from "../ui/BottomSheetPicker.jsx";
import { GroupAvatar } from "./GroupAvatar.jsx";
import { LocationField } from "../posts/LocationField.jsx";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { useInk } from "../../lib/useInk.js";
import {
  RSVP_POLICIES,
  groupVisibilityOptions,
} from "../../lib/groups.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

export function GroupForm({
  initialValues = {},
  mode = "create",
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) {
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const { keyboardInset } = useKeyboardInset();
  const insets = useSafeAreaInsets();
  const ink = useInk();

  const [name, setName] = useState(initialValues.name || "");
  const [summary, setSummary] = useState(
    initialValues.summary || ""
  );
  const [location, setLocation] = useState(initialValues.location || null);
  const [to, setTo] = useState(initialValues.to ?? "@public");
  const [rsvpPolicy, setRsvpPolicy] = useState(
    initialValues.rsvpPolicy || "open"
  );
  const [iconAsset, setIconAsset] = useState(null); // newly picked
  const [iconUrl, setIconUrl] = useState(initialValues.icon || null);

  const [bannerAsset, setBannerAsset] = useState(null);
  const [bannerUrl, setBannerUrl] = useState(initialValues.image || null);

  const [myCircles, setMyCircles] = useState([]);

  // Load the user's circles so they can scope the group to one.
  useEffect(() => {
    if (!client || !account?.id) return;
    let cancelled = false;
    client.feeds
      .getUserCircles({ userId: account.id })
      .then((res) => {
        const items = res?.orderedItems || res?.items || [];
        if (!cancelled) {
          setMyCircles(items.filter((c) => c?.id && c?.type !== "System"));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, account?.id]);

  const baseVisibility = groupVisibilityOptions(
    account?.server,
    account?.serverName
  );
  const visibilityOptions = [
    ...baseVisibility,
    ...myCircles.map((c) => ({
      value: c.id,
      label: c.name,
      summary: c.summary,
      group: "Restrict to a circle",
    })),
  ];

  async function pickIcon() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setIconAsset({
        uri: asset.uri,
        name: asset.fileName || `group-icon-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
      setIconUrl(null);
    } catch {
      // ignore picker errors
    }
  }

  async function pickBanner() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setBannerAsset({
        uri: asset.uri,
        name: asset.fileName || `group-banner-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
      setBannerUrl(null);
    } catch {
      // ignore picker errors
    }
  }

  function submit() {
    if (!name.trim() || submitting) return;
    onSubmit?.({
      name: name.trim(),
      summary: summary.trim(),
      location,
      to,
      rsvpPolicy,
      iconAsset,
      iconUrl,
      bannerAsset,
      bannerUrl,
    });
  }

  const previewGroup = { icon: iconAsset?.uri || iconUrl, name };

  return (
    <View className="flex-1">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 20 + keyboardInset }}
      >
        {/* Banner image */}
        <View className="mb-5 -mx-5 -mt-5">
          <Pressable
            onPress={pickBanner}
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            style={{ aspectRatio: 3 }}
            className="w-full bg-base-200 items-center justify-center overflow-hidden"
          >
            {bannerAsset?.uri || bannerUrl ? (
              <Image
                source={{ uri: bannerAsset?.uri || bannerUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text className="font-ui text-[11px] uppercase tracking-[0.16em] text-base-content/40">
                Tap to add banner image
              </Text>
            )}
          </Pressable>
          {(bannerAsset || bannerUrl) ? (
            <Pressable
              onPress={() => { setBannerAsset(null); setBannerUrl(null); }}
              hitSlop={8}
              className="self-end px-5 pt-1.5"
            >
              <Text className="font-ui text-[10px] uppercase tracking-[0.14em] text-base-content/40">
                Remove banner
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Icon + name */}
        <View className="flex-row items-center mb-5">
          <Pressable onPress={pickIcon} className="relative">
            <GroupAvatar
              group={previewGroup}
              size={64}
              baseUrl={account?.baseUrl}
            />
            <View className="absolute -bottom-1 -right-1 bg-base-100   p-1">
              <ImagePlus
                size={13}
                color={ink(0.85)}
                strokeWidth={1.75}
              />
            </View>
          </Pressable>
          <View className="flex-1 ml-4">
            <FieldLabel>Name</FieldLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Group name"
              placeholderTextColor={ink(0.35)}
              className="  bg-field px-3 py-2.5 font-ui text-base text-base-content"
            />
          </View>
        </View>

        {/* Description */}
        <View className="mb-5">
          <FieldLabel>Description</FieldLabel>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            multiline
            placeholder="What's this group for?"
            placeholderTextColor={ink(0.35)}
            className="  bg-field px-3 py-2.5 font-ui text-base text-base-content min-h-20"
          />
        </View>

        {/* Location */}
        <View className="mb-5">
          <FieldLabel>Location (optional)</FieldLabel>
          <LocationField value={location} onChange={setLocation} />
        </View>

        {/* Visibility */}
        <View className="mb-5">
          <FieldLabel>Visibility</FieldLabel>
          <BottomSheetPicker
            label="To"
            value={to}
            options={visibilityOptions}
            onChange={setTo}
            title="Who can see this group"
          />
          <Text className="font-ui text-xs text-base-content/55 mt-1.5">
            {visibilityOptions.find((o) => o.value === to)?.summary || ""}
          </Text>
        </View>

        {/* RSVP Policy */}
        <View className="mb-5">
          <FieldLabel>Joining</FieldLabel>
          <BottomSheetPicker
            label="Policy"
            value={rsvpPolicy}
            options={RSVP_POLICIES}
            onChange={setRsvpPolicy}
            title="How people join"
          />
          <Text className="font-ui text-xs text-base-content/55 mt-1.5">
            {RSVP_POLICIES.find((o) => o.value === rsvpPolicy)?.summary || ""}
          </Text>
        </View>

        {error ? (
          <Text className="font-ui text-xs text-error mb-3">{error}</Text>
        ) : null}
      </ScrollView>

      {/* Footer — pad past Android's nav bar; zero the extra padding when the
          keyboard is up (window resizes, nav bar hidden). */}
      <View
        className="flex-row items-center justify-end px-5 pt-3  "
        style={{ paddingBottom: (keyboardInset > 0 ? 0 : insets.bottom) + 12 }}
      >
        <Pressable onPress={onCancel} hitSlop={6} className="px-4 py-2.5 mr-2">
          <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={!name.trim() || submitting}
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          className={`flex-row items-center px-5 py-2.5 bg-primary ${
            !name.trim() || submitting ? "opacity-40" : ""
          }`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FAF4E8" />
          ) : (
            <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
              {mode === "edit" ? "Save Changes" : "Create Group"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
