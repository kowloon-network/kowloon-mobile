// Create a group. Uploads the icon (if picked), creates the group, and
// navigates to it on success.

import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { GroupForm } from "../../src/components/groups/GroupForm.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { uploadFile } from "../../src/lib/uploadFile.js";

function extractGroupId(res) {
  return (
    res?.createdId ||
    res?.created?.id ||
    res?.result?.created?.id ||
    res?.result?.id ||
    res?.activity?.object?.id ||
    res?.id ||
    null
  );
}

export default function NewGroup() {
  const router = useRouter();
  const client = useActiveClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit({
    name,
    summary,
    location,
    to,
    rsvpPolicy,
    iconAsset,
    bannerAsset,
    bannerUrl,
  }) {
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
          // Group icon/banner are always @public — they show in Discover, search,
          // and member lists. Inheriting the group's `to` made a server-only
          // group's icon restricted, so it 401'd and never displayed (#69).
          to: "@public",
          generateThumbnail: true,
        });
        iconUrl = up?.file?.url;
      }

      let imageUrl = bannerUrl || undefined;
      if (bannerAsset?.uri) {
        const up = await uploadFile(client, {
          uri: bannerAsset.uri,
          name: bannerAsset.name,
          mimeType: bannerAsset.mimeType,
          to: "@public",
        });
        imageUrl = up?.file?.url;
      }

      const res = await client.activities.createGroup({
        name,
        description: summary || undefined,
        location: location || undefined,
        icon: iconUrl || undefined,
        image: imageUrl || undefined,
        to,
        membershipPolicy: rsvpPolicy,
      });
      const newId = extractGroupId(res);

      if (newId) {
        router.replace(`/group/${encodeURIComponent(newId)}`);
      } else {
        router.back();
      }
    } catch (e) {
      setError(e?.message || "Couldn't create the group.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="New Group" />
      <GroupForm
        mode="create"
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </SafeAreaView>
  );
}
