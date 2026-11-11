// Admin invites -- the list: share/copy each link, show its QR, deactivate.
// New invites are created on their own screen (app/admin/invite/new.js).

import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader, HeaderButton } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { InviteCard } from "../../src/components/admin/InviteCard.jsx";

export default function AdminInvites() {
  const client = useActiveClient();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.admin.getInvites({});
        setItems(res?.orderedItems || res?.items || []);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load invites."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client]
  );

  // Reload on every visit, so an invite made on the New screen shows up.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function onDeactivate(invite) {
    Alert.alert("Deactivate invite?", "The link will stop working.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          try {
            await client.admin.deleteInvite({ inviteId: invite.id });
            setItems((arr) =>
              arr.map((i) => (i.id === invite.id ? { ...i, active: false } : i))
            );
          } catch (e) {
            Alert.alert("Couldn't deactivate", e?.message || "Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title="Invites"
        right={<HeaderButton label="New" onPress={() => router.push("/admin/invite/new")} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />}
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="font-ui text-sm text-error px-5 py-6">{error}</Text>
        ) : items.length === 0 ? (
          <View className="px-6 py-20 items-center">
            <Text className="font-ui text-base text-base-content/70 text-center mb-1">No invites yet.</Text>
            <Text className="font-ui text-sm text-base-content/45 text-center leading-6">
              Tap New to create an open link or email someone an invite.
            </Text>
          </View>
        ) : (
          items.map((invite) => (
            <InviteCard key={invite.id} invite={invite} onDeactivate={onDeactivate} />
          ))
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
