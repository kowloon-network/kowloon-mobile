// Create a server Page.

import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { PageForm } from "../../../src/components/admin/PageForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";

function serverDomainOf(client) {
  return (client?.http?.baseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
}

export default function NewPage() {
  const router = useRouter();
  const client = useActiveClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(values) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.admin.createPage(values);
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't create the page.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="New Page" />
      <PageForm
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
