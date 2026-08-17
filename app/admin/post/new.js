// Create a server-announcement post via the admin API.

import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { AdminPostForm } from "../../../src/components/admin/AdminPostForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { uploadFile } from "../../../src/lib/uploadFile.js";

function serverDomainOf(client) {
  return (client?.http?.baseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
}

export default function NewAdminPost() {
  const router = useRouter();
  const client = useActiveClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit({ type, title, source, tags, to, imageAsset }) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let image;
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

      await client.admin.createPost({
        type,
        title,
        source,
        tags,
        to,
        image,
      });
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't create the post.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="New Post" />
      <AdminPostForm
        mode="create"
        serverDomain={serverDomainOf(client)}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </SafeAreaView>
  );
}
