// Edit a server-announcement post (or delete it). 403s if the post wasn't
// created by this server.

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader, HeaderButton } from "../../../src/components/nav/AppHeader.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { AdminPostForm } from "../../../src/components/admin/AdminPostForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { uploadFile } from "../../../src/lib/uploadFile.js";

function serverDomainOf(client) {
  return (client?.http?.baseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
}

export default function EditAdminPost() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.admin.getPost({ postId: String(id) });
      const p = res?.post || res?.item || res || null;
      if (p?.image && typeof p.image === "string" && p.image.startsWith("file:")) {
        p.image = client.files.serveUrl(p.image);
      }
      setPost(p);
    } catch (e) {
      setLoadError(e?.message || "Couldn't load this post.");
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit({ type, title, source, tags, to, imageAsset, imageUrl }) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let image = imageUrl;
      if (imageAsset?.uri) {
        const up = await uploadFile(client, {
          uri: imageAsset.uri,
          name: imageAsset.name,
          mimeType: imageAsset.mimeType,
          to,
          generateThumbnail: true,
        });
        image = up?.file?.url;
      }

      await client.admin.updatePost({
        postId: String(id),
        updates: { type, title, source, tags, to, image },
      });
      router.back();
    } catch (e) {
      setError(
        e?.status === 403 || e?.statusCode === 403
          ? "Only posts this server created can be edited here."
          : e?.message || "Couldn't save changes."
      );
      setSubmitting(false);
    }
  }

  function handleDelete() {
    Alert.alert("Delete post?", "It can be restored later from the Deleted tab.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await client.admin.deletePost({ postId: String(id) });
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
        title="Edit Post"
        right={post ? <HeaderButton label="Delete" onPress={handleDelete} /> : null}
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
      ) : post ? (
        <AdminPostForm
          mode="edit"
          initialValues={post}
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
