// Create a server-owned group via the admin API.

import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { AdminGroupForm } from "../../../src/components/admin/AdminGroupForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { uploadFile } from "../../../src/lib/uploadFile.js";

function serverDomainOf(client) {
  return (client?.http?.baseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
}

export default function NewAdminGroup() {
  const router = useRouter();
  const client = useActiveClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit({ name, summary, rsvpPolicy, to, iconAsset }) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let iconUrl;
      if (iconAsset?.uri) {
        const up = await uploadFile(client, {
          uri: iconAsset.uri,
          name: iconAsset.name,
          mimeType: iconAsset.mimeType,
          to,
          generateThumbnail: true,
        });
        iconUrl = up?.file?.url;
      }

      await client.admin.createGroup({
        name,
        summary,
        rsvpPolicy,
        icon: iconUrl || undefined,
        to,
      });
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't create the group.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="New Group" />
      <AdminGroupForm
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
