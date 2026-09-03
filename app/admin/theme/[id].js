// Edit an existing (non-built-in) theme, or delete it.

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader, HeaderButton } from "../../../src/components/nav/AppHeader.jsx";
import { AdminThemeForm } from "../../../src/components/admin/AdminThemeForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";

export default function EditAdminTheme() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();

  const [theme, setTheme] = useState(null);
  const [presets, setPresets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.themes.list();
      const themes = res?.themes ?? [];
      const found = themes.find((t) => t.id === String(id));
      if (!found) {
        setLoadError("Theme not found.");
      } else {
        setTheme(found);
        setPresets({
          light: themes.find((t) => t.id === "kowloon-light"),
          dark: themes.find((t) => t.id === "kowloon-dark"),
        });
      }
    } catch (e) {
      setLoadError(e?.message || "Couldn't load this theme.");
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(values) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.themes.update(String(id), values);
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't save changes.");
      setSubmitting(false);
    }
  }

  function handleDelete() {
    Alert.alert("Delete theme?", `"${theme?.name}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await client.themes.delete(String(id));
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete", e?.message || "Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title="Edit Theme"
        right={theme ? <HeaderButton label="Delete" onPress={handleDelete} /> : null}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : loadError ? (
        <View className="px-6 py-20 items-center">
          <Text className="font-ui text-sm text-error text-center">{loadError}</Text>
        </View>
      ) : (
        <AdminThemeForm
          mode="edit"
          initialValues={theme}
          presets={presets}
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}
