// Edit a circle (owner only). Loads the circle, shows the shared form, then
// on save: updates fields, uploads a new icon if picked, and diffs the member
// list into add/remove calls.

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { CircleForm } from "../../../src/components/circles/CircleForm.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { uploadFile } from "../../../src/lib/uploadFile.js";
import { selectActiveAccount } from "../../../src/state/accountsSlice.js";

export default function EditCircle() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);

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
      const res = await client.feeds.getCircle({ circleId: String(id) });
      setCircle(res?.item || res?.circle || res || null);
    } catch (e) {
      setLoadError(e?.message || "Couldn't load this circle.");
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  const ownerId = circle?.actorId || circle?.actor?.id;
  const isOwner = !!account?.id && ownerId === account.id;

  async function handleSubmit({ name, description, to, iconAsset, iconUrl, members }) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Upload a freshly-picked icon, if any.
      let finalIcon = iconUrl || undefined;
      if (iconAsset?.uri) {
        const up = await uploadFile(client, {
          uri: iconAsset.uri,
          name: iconAsset.name,
          mimeType: iconAsset.mimeType,
          to,
          generateThumbnail: true,
        });
        finalIcon = up?.file?.url || finalIcon;
      }

      await client.activities.updateCircle({
        circleId: String(id),
        name,
        description,
        icon: finalIcon,
        to,
      });

      // Diff membership: add new, remove dropped.
      const originalIds = new Set(
        (circle?.members || []).map((m) => m.id)
      );
      const nextIds = new Set(members.map((m) => m.id));
      const toAdd = members.filter((m) => !originalIds.has(m.id));
      const toRemove = [...originalIds].filter((mid) => !nextIds.has(mid));

      if (toAdd.length) {
        await client.activities.addToCircle({
          circleId: String(id),
          members: toAdd,
        });
      }
      for (const memberId of toRemove) {
        await client.activities.removeFromCircle({
          circleId: String(id),
          memberId,
        });
      }

      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't save changes.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title={circle?.type === "System" ? "Edit Visibility" : "Edit Circle"} />

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
            You can only edit circles you own.
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : circle ? (
        <CircleForm
          mode="edit"
          initialValues={circle}
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          lockMetadata={circle.type === "System"}
        />
      ) : null}
    </SafeAreaView>
  );
}
