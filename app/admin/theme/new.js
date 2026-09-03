// Create a new theme, prefilled from the site's Light theme.

import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { AdminThemeForm } from "../../../src/components/admin/AdminThemeForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";

export default function NewAdminTheme() {
  const router = useRouter();
  const client = useActiveClient();

  const [presets, setPresets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.themes
      .list()
      .then((res) => {
        if (cancelled) return;
        const themes = res?.themes ?? [];
        setPresets({
          light: themes.find((t) => t.id === "kowloon-light"),
          dark: themes.find((t) => t.id === "kowloon-dark"),
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [client]);

  async function handleSubmit(values) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.themes.create(values);
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't create the theme.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="New Theme" />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <AdminThemeForm
          mode="create"
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
