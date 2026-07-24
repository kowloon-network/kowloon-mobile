// Edit an existing server Page (or delete it).

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader, HeaderButton } from "../../../src/components/nav/AppHeader.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { PageForm } from "../../../src/components/admin/PageForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";

function serverDomainOf(client) {
  return (client?.http?.baseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
}

export default function EditPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.admin.getPage({ pageId: String(id) });
      setPage(res?.page || res?.item || res || null);
    } catch (e) {
      setLoadError(e?.message || "Couldn't load this page.");
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
      await client.admin.updatePage({ pageId: String(id), updates: values });
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't save changes.");
      setSubmitting(false);
    }
  }

  function handleDelete() {
    Alert.alert("Delete page?", "It can be restored later from the Deleted tab.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await client.admin.deletePage({ pageId: String(id) });
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
        title="Edit Page"
        right={page ? <HeaderButton label="Delete" onPress={handleDelete} /> : null}
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
      ) : page ? (
        <PageForm
          mode="edit"
          initialValues={page}
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
