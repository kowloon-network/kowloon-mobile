// CircleForm — shared create/edit form for circles.
//
// Fields: icon (pick + upload), name, description, visibility, and members
// (search via /users/search, add/remove as chips). The parent route owns the
// actual createCircle/updateCircle + icon upload; this form just collects and
// hands back { name, description, to, iconUri, iconUrl, members } via onSubmit.

import { useEffect, useRef, useState } from "react";
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
import { ImagePlus, X } from "lucide-react-native";

import { Avatar } from "../posts/Avatar.jsx";
import { CircleAvatar } from "./CircleAvatar.jsx";
import { useActiveClient } from "../../lib/useActiveClient.js";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { circleVisibilityOptions } from "../../lib/circles.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";
import { useInk } from "../../lib/useInk.js";

const SEARCH_DEBOUNCE_MS = 350;

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

function memberView(m) {
  return {
    id: m?.id,
    name: m?.name || m?.displayName || m?.id,
    icon: m?.icon || m?.profile?.icon || null,
  };
}

export function CircleForm({
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
  const [description, setDescription] = useState(
    initialValues.description || initialValues.summary || ""
  );
  // Circles are personal by default — "Only Me" (self-addressed to the owner),
  // not public. A circle is a private contact list; public is an explicit opt-in. (#48)
  const [to, setTo] = useState(initialValues.to ?? account?.id ?? "@public");
  const [iconAsset, setIconAsset] = useState(null); // newly picked { uri, name, mimeType }
  const [iconUrl, setIconUrl] = useState(initialValues.icon || null); // existing
  const [members, setMembers] = useState(
    Array.isArray(initialValues.members)
      ? initialValues.members.map(memberView)
      : []
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const visibilityOptions = circleVisibilityOptions(
    account?.server,
    account?.serverName,
    account?.id
  );
  const memberIds = new Set(members.map((m) => m.id));

  // Debounced member search.
  // Suppress auto-search for partial federated handles (@user@partial) — wait
  // until the domain part contains a dot (@user@host.tld) before hitting the
  // network, to avoid spamming WebFinger with incomplete domain names.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const parts = q.replace(/^@/, "").split("@");
    const isPartialFederated = parts.length === 2 && !parts[1].includes(".");
    if (isPartialFederated) return;

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await client.feeds.http.get("/users/search", {
          params: { q },
        });
        setResults((res?.orderedItems || res?.items || []).map(memberView));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, client]);

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
        name: asset.fileName || `circle-icon-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
      setIconUrl(null);
    } catch {
      // ignore picker errors
    }
  }

  function addMember(m) {
    if (memberIds.has(m.id)) return;
    setMembers((prev) => [...prev, m]);
    setQuery("");
    setResults([]);
  }

  function removeMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function submit() {
    if (!name.trim() || submitting) return;
    onSubmit?.({
      name: name.trim(),
      description: description.trim(),
      to,
      iconAsset,
      iconUrl,
      members,
    });
  }

  const previewCircle = { icon: iconAsset?.uri || iconUrl, name };

  return (
    <View className="flex-1">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 20 + keyboardInset }}
      >
        {/* Icon + name */}
        <View className="flex-row items-center mb-5">
          <Pressable onPress={pickIcon} className="relative">
            <CircleAvatar
              circle={previewCircle}
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
              placeholder="Circle name"
              placeholderTextColor={ink(0.35)}
              className="  bg-white px-3 py-2.5 font-ui text-base text-base-content"
            />
          </View>
        </View>

        {/* Description */}
        <View className="mb-5">
          <FieldLabel>Description</FieldLabel>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="What's this circle for?"
            placeholderTextColor={ink(0.35)}
            className="  bg-white px-3 py-2.5 font-ui text-base text-base-content min-h-16"
          />
        </View>

        {/* Visibility */}
        <View className="mb-5">
          <FieldLabel>Visibility</FieldLabel>
          <View className="flex-row" style={{ gap: 8 }}>
            {visibilityOptions.map((opt) => {
              const selected = to === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => setTo(opt.value)}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  className="flex-1"
                >
                  {/* Background on an inner View: a bg on the ripple-owning
                      Pressable node doesn't repaint on selection change. */}
                  <View
                    className="px-2 py-2.5"
                    style={{ backgroundColor: selected ? "#5588B1" : "#F4F4F4" }}
                  >
                    <Text
                      className="font-ui uppercase tracking-[0.12em] text-[11px] text-center"
                      style={{ color: selected ? "#F4F5F7" : ink(0.7) }}
                    >
                      {opt.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text className="font-ui text-xs text-base-content/55 mt-1.5">
            {visibilityOptions.find((o) => o.value === to)?.summary || ""}
          </Text>
        </View>

        {/* Members */}
        <View className="mb-5">
          <FieldLabel>Members</FieldLabel>

          {members.length > 0 ? (
            <View className="mb-2">
              {members.map((m) => (
                <View
                  key={m.id}
                  className="flex-row items-center py-2  "
                >
                  <Avatar actor={m} size={32} baseUrl={account?.baseUrl} />
                  <View className="flex-1 ml-3 min-w-0">
                    <Text
                      className="font-ui text-sm text-base-content"
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    <Text
                      className="font-ui text-xs text-base-content/55"
                      numberOfLines={1}
                    >
                      {m.id}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeMember(m.id)}
                    hitSlop={8}
                    android_ripple={{
                      color: "rgba(0,0,0,0.06)",
                      borderless: true,
                    }}
                    className="ml-2 p-1"
                  >
                    <X size={18} color={ink(0.45)} strokeWidth={1.75} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, @handle, or @user@other.server"
            placeholderTextColor={ink(0.35)}
            autoCapitalize="none"
            autoCorrect={false}
            className="  bg-white px-3 py-2.5 font-ui text-base text-base-content"
          />

          {searching ? (
            <View className="py-3 items-start">
              <ActivityIndicator />
            </View>
          ) : results.length > 0 ? (
            <View className="  ">
              {results.map((m) => {
                const already = memberIds.has(m.id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => !already && addMember(m)}
                    disabled={already}
                    android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                    className="flex-row items-center px-3 py-2.5  "
                  >
                    <Avatar actor={m} size={30} baseUrl={account?.baseUrl} />
                    <View className="flex-1 ml-3 min-w-0">
                      <Text
                        className="font-ui text-sm text-base-content"
                        numberOfLines={1}
                      >
                        {m.name}
                      </Text>
                      <Text
                        className="font-ui text-xs text-base-content/55"
                        numberOfLines={1}
                      >
                        {m.id}
                      </Text>
                    </View>
                    <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/45 ml-2">
                      {already ? "Added" : "Add"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {error ? (
          <Text className="font-ui text-xs text-error mb-3">{error}</Text>
        ) : null}
      </ScrollView>

      {/* Footer — pad past Android's nav bar (and don't double-pad when the
          keyboard is up, where the window resizes and the nav bar is gone). */}
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
              {mode === "edit" ? "Save Changes" : "Create Circle"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
