// Create a server-owned bookmark or folder.

import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { AdminBookmarkForm } from "../../../src/components/admin/AdminBookmarkForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";

function serverDomainOf(client) {
  return (client?.http?.baseUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
}

export default function NewBookmark() {
  const router = useRouter();
  const client = useActiveClient();
  const [folders, setFolders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!client) return;
    client.admin
      .getBookmarks({ type: "Folder" })
      .then((res) => {
        const items = res?.orderedItems || res?.items || [];
        setFolders(items.filter((f) => !f.parentFolder));
      })
      .catch(() => {});
  }, [client]);

  async function handleSubmit(values) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.admin.createBookmark(values);
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't create the bookmark.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="New Bookmark" />
      <AdminBookmarkForm
        mode="create"
        serverDomain={serverDomainOf(client)}
        folders={folders}
        client={client}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </SafeAreaView>
  );
}
