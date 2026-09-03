// AdminThemeForm — create/edit a server theme. Mirrors the web admin theme
// editor (frontend/src/pages/admin/AdminThemesPage.jsx): same plain-language
// grouped labels, same "Start From" Light/Dark presets, same behavior of
// prefilling a new theme from the site's Light theme instead of blank fields.

import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ColorField } from "./ColorField.jsx";
import { SegmentedControl } from "../ui/SegmentedControl.jsx";
import { useKeyboardInset } from "../../lib/useKeyboardInset.js";
import { useInk } from "../../lib/useInk.js";

const SCHEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const TOKEN_GROUPS = [
  {
    title: "Backgrounds & Text",
    tokens: [
      { key: "base-100", label: "Page Background", hint: "The main background behind all content" },
      { key: "base-200", label: "Card Background", hint: "Cards, panels, and hover states" },
      { key: "base-300", label: "Borders & Dividers", hint: "Lines between sections and around boxes" },
      { key: "base-content", label: "Body Text", hint: "The default text color" },
    ],
  },
  {
    title: "Primary Color",
    tokens: [
      { key: "primary", label: "Primary Color", hint: "Buttons, links, and highlights" },
      { key: "primary-content", label: "Text on Primary", hint: "Text and icons shown on the primary color" },
    ],
  },
  {
    title: "Secondary Color",
    tokens: [
      { key: "secondary", label: "Secondary Color", hint: "Sidebar and secondary buttons" },
      { key: "secondary-content", label: "Text on Secondary", hint: "Text and icons shown on the secondary color" },
    ],
  },
  {
    title: "Accent Color",
    tokens: [
      { key: "accent", label: "Accent Color", hint: "Extra highlights and decorative touches" },
      { key: "accent-content", label: "Text on Accent", hint: "Text and icons shown on the accent color" },
    ],
  },
  {
    title: "Dark Surface",
    tokens: [
      { key: "neutral", label: "Dark Surface", hint: "Dark menus and panels" },
      { key: "neutral-content", label: "Text on Dark Surface", hint: "Text and icons on dark panels" },
    ],
  },
  {
    title: "Status Colors",
    tokens: [
      { key: "info", label: "Info Color", hint: "Informational messages" },
      { key: "info-content", label: "Text on Info", hint: "" },
      { key: "success", label: "Success Color", hint: "Confirmations and successful actions" },
      { key: "success-content", label: "Text on Success", hint: "" },
      { key: "warning", label: "Warning Color", hint: "Warnings and caution messages" },
      { key: "warning-content", label: "Text on Warning", hint: "" },
      { key: "error", label: "Error Color", hint: "Errors and destructive actions" },
      { key: "error-content", label: "Text on Error", hint: "" },
    ],
  },
];
const COLOR_TOKENS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.key));

const POST_COLOR_FIELDS = [
  { key: "note", label: "Note Posts" },
  { key: "article", label: "Article Posts" },
  { key: "media", label: "Media Posts" },
  { key: "link", label: "Link Posts" },
  { key: "event", label: "Event Posts" },
];
const POST_COLOR_KEYS = POST_COLOR_FIELDS.map((f) => f.key);

const BLANK_COLORS = Object.fromEntries(COLOR_TOKENS.map((t) => [t, ""]));
const BLANK_POST_COLORS = Object.fromEntries(POST_COLOR_KEYS.map((k) => [k, "#888888"]));

function FieldLabel({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

export function AdminThemeForm({
  mode = "create",
  initialValues = null,
  presets = null, // { light: theme, dark: theme } -- the built-in themes
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) {
  const { keyboardInset } = useKeyboardInset();
  const insets = useSafeAreaInsets();
  const ink = useInk();
  const isEdit = mode === "edit";
  const lightPreset = presets?.light;
  const darkPreset = presets?.dark;

  const [id, setId] = useState(initialValues?.id || "");
  const [name, setName] = useState(initialValues?.name || "");
  const [description, setDescription] = useState(initialValues?.description || "");
  const [colorScheme, setColorScheme] = useState(
    initialValues?.colorScheme || "light"
  );
  const [colors, setColors] = useState({
    ...BLANK_COLORS,
    ...(initialValues?.colors ?? lightPreset?.colors ?? {}),
  });
  const [postColors, setPostColors] = useState({
    ...BLANK_POST_COLORS,
    ...(initialValues?.postColors ?? lightPreset?.postColors ?? {}),
  });

  const setColor = (key, val) => setColors((c) => ({ ...c, [key]: val }));
  const setPostColor = (key, val) => setPostColors((c) => ({ ...c, [key]: val }));

  function applyPreset(preset, scheme) {
    if (!preset) return;
    setColorScheme(scheme);
    setColors({ ...BLANK_COLORS, ...(preset.colors ?? {}) });
    setPostColors({ ...BLANK_POST_COLORS, ...(preset.postColors ?? {}) });
  }

  function handleSave() {
    if (submitting) return;
    onSubmit?.({
      id: isEdit ? initialValues.id : id.trim().toLowerCase().replace(/\s+/g, "-"),
      name: name.trim(),
      description: description.trim(),
      colorScheme,
      colors,
      postColors,
    });
  }

  const canSave = (isEdit || !!id.trim()) && !!name.trim() && !submitting;

  return (
    <View className="flex-1">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 20 + keyboardInset, gap: 20 }}
      >
        {(lightPreset || darkPreset) && (
          <View className="gap-2">
            <FieldLabel>Start From</FieldLabel>
            <View className="flex-row gap-2">
              {lightPreset ? (
                <Pressable
                  onPress={() => applyPreset(lightPreset, "light")}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  className="px-4 py-2 border border-base-300"
                >
                  <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content">
                    Light Theme
                  </Text>
                </Pressable>
              ) : null}
              {darkPreset ? (
                <Pressable
                  onPress={() => applyPreset(darkPreset, "dark")}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  className="px-4 py-2 border border-base-300"
                >
                  <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content">
                    Dark Theme
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="font-reading text-xs text-base-content/40 italic">
              Fills in every color below as a starting point — change any of them afterward.
            </Text>
          </View>
        )}

        {!isEdit ? (
          <View>
            <FieldLabel>ID</FieldLabel>
            <TextInput
              value={id}
              onChangeText={(v) => setId(v.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="my-theme"
              placeholderTextColor={ink(0.3)}
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-field px-3 py-2.5 font-mono text-sm text-base-content"
            />
          </View>
        ) : null}

        <View>
          <FieldLabel>Name</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Theme name"
            placeholderTextColor={ink(0.35)}
            className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
          />
        </View>

        <View>
          <FieldLabel>Description</FieldLabel>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor={ink(0.35)}
            className="bg-field px-3 py-2.5 font-ui text-base text-base-content"
          />
        </View>

        <View>
          <FieldLabel>Color Scheme</FieldLabel>
          <SegmentedControl options={SCHEME_OPTIONS} value={colorScheme} onChange={setColorScheme} />
        </View>

        {colorScheme !== "system" ? (
          <>
            <View className="gap-5">
              <Text className="font-ui text-lg text-base-content border-b border-base-300 pb-1">
                UI Colors
              </Text>
              {TOKEN_GROUPS.map((group) => (
                <View key={group.title} className="gap-2.5">
                  <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/50">
                    {group.title}
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    {group.tokens.map((t) => (
                      <ColorField
                        key={t.key}
                        token={t.key}
                        label={t.label}
                        hint={t.hint}
                        value={colors[t.key] ?? ""}
                        onChange={(v) => setColor(t.key, v)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View className="gap-1">
              <Text className="font-ui text-lg text-base-content border-b border-base-300 pb-1">
                Post Type Colors
              </Text>
              <Text className="font-reading text-xs text-base-content/40 italic mb-1">
                The accent color shown next to each kind of post in the feed.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {POST_COLOR_FIELDS.map(({ key, label }) => (
                  <ColorField
                    key={key}
                    token={key}
                    label={label}
                    value={postColors[key] ?? ""}
                    onChange={(v) => setPostColor(key, v)}
                  />
                ))}
              </View>
            </View>
          </>
        ) : null}

        {error ? <Text className="font-ui text-xs text-error">{error}</Text> : null}
      </ScrollView>

      <View
        className="flex-row items-center justify-end px-5 pt-3 border-t border-base-200"
        style={{ paddingBottom: (keyboardInset > 0 ? 0 : insets.bottom) + 12 }}
      >
        <Pressable onPress={onCancel} hitSlop={6} className="px-4 py-2.5 mr-2">
          <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          className={`px-5 py-2.5 bg-primary ${canSave ? "" : "opacity-40"}`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FAF4E8" />
          ) : (
            <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
              {isEdit ? "Save" : "Create"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
