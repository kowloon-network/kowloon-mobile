// Edit a server-owned circle (or delete it). 403s if the circle wasn't
// created by this server (user-owned circles aren't editable here).

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader, HeaderButton } from "../../../src/components/nav/AppHeader.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { AdminCircleForm } from "../../../src/components/admin/AdminCircleForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { uploadFile } from "../../../src/lib/uploadFile.js";

function serverDomainOf(client) {
  return (client?.http?.baseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
}

export default function EditAdminCircle() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();

  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.admin.getCircle({ circleId: String(id) });
      setCircle(res?.circle || res?.item || res || null);
    } catch (e) {
      setLoadError(e?.message || "Couldn't load this circle.");
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit({ name, summary, to, iconAsset, iconUrl }) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let icon = iconUrl;
      if (iconAsset?.uri) {
        const up = await uploadFile(client, {
          uri: iconAsset.uri,
          name: iconAsset.name,
          mimeType: iconAsset.mimeType,
          to,
          generateThumbnail: true,
        });
        icon = up?.file?.url;
      }

      await client.admin.updateCircle({
        circleId: String(id),
        updates: { name, summary, icon, to },
      });
      router.back();
    } catch (e) {
      setError(
        e?.status === 403 || e?.statusCode === 403
          ? "Only circles this server created can be edited here."
          : e?.message || "Couldn't save changes."
      );
      setSubmitting(false);
    }
  }

  function handleDelete() {
    Alert.alert("Delete circle?", "It can be restored later from the Deleted tab.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await client.admin.deleteCircle({ circleId: String(id) });
            router.back();
          } catch (e) {
            Alert.alert(
              "Couldn't delete",
              e?.status === 403 || e?.statusCode === 403
                ? "Only circles this server created can be deleted here."
                : e?.message || "Please try again."
            );
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title="Edit Circle"
        right={circle ? <HeaderButton label="Delete" onPress={handleDelete} /> : null}
      />

      {loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : loadError ? (
        <View className="py-20 items-center px-6">
          <Text className="font-ui text-base text-error text-center mb-4">{loadError}</Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : circle ? (
        <AdminCircleForm
          mode="edit"
          initialValues={circle}
          serverDomain={serverDomainOf(client)}
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      ) : null}
    </SafeAreaView>
  );
}
