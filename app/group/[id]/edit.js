// Edit a group (owner only). Loads the group, shows the shared form, and
// on save: updates fields and uploads a new icon if picked.

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { GroupForm } from "../../../src/components/groups/GroupForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { uploadFile } from "../../../src/lib/uploadFile.js";
import { selectActiveAccount } from "../../../src/state/accountsSlice.js";

export default function EditGroup() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.feeds.getGroup({ groupId: String(id) });
      setGroup(res?.item || res?.group || res || null);
    } catch (e) {
      setLoadError(e?.message || "Couldn't load this group.");
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  const ownerId = group?.actorId || group?.actor?.id;
  const isOwner = !!account?.id && ownerId === account.id;

  async function handleSubmit({
    name,
    summary,
    location,
    to,
    rsvpPolicy,
    iconAsset,
    iconUrl,
    bannerAsset,
    bannerUrl,
  }) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let finalIcon = iconUrl || undefined;
      if (iconAsset?.uri) {
        const up = await uploadFile(client, {
          uri: iconAsset.uri,
          name: iconAsset.name,
          mimeType: iconAsset.mimeType,
          // Icon/banner are always public — see app/group/new.js (#69).
          to: "@public",
          generateThumbnail: true,
        });
        finalIcon = up?.file?.url || finalIcon;
      }

      let finalImage = bannerUrl || undefined;
      if (bannerAsset?.uri) {
        const up = await uploadFile(client, {
          uri: bannerAsset.uri,
          name: bannerAsset.name,
          mimeType: bannerAsset.mimeType,
          to: "@public",
        });
        finalImage = up?.file?.url || finalImage;
      }

      await client.activities.updateGroup({
        groupId: String(id),
        name,
        description: summary,
        location,
        icon: finalIcon,
        image: finalImage,
        to,
        membershipPolicy: rsvpPolicy,
      });
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't save changes.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="Edit Group" />

      {loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : loadError ? (
        <View className="py-20 items-center px-6">
          <Text className="font-ui text-base text-error text-center mb-4">
            {loadError}
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : !isOwner ? (
        <View className="py-20 items-center px-6">
          <Text className="font-ui text-base text-base-content/70 text-center mb-4">
            You can only edit groups you own.
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : group ? (
        <GroupForm
          mode="edit"
          initialValues={group}
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      ) : null}
    </SafeAreaView>
  );
}
