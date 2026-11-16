// Admin settings -- the few server settings worth changing from a phone.
// Everything else (name, rules, email server, backups) stays on the web
// admin, linked at the bottom. Admin only; moderators never see the entry.

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExternalLink } from "lucide-react-native";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useInk } from "../../src/lib/useInk.js";

export default function AdminSettings() {
  const client = useActiveClient();
  const ink = useInk();

  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      const res = await client.admin.getSettings();
      setSettings(Object.fromEntries((res?.settings || []).map((s) => [s.name, s.value])));
    } catch (e) {
      setError(
        e?.status === 403 || e?.statusCode === 403
          ? "Only server admins can change settings."
          : e?.message || "Couldn't load settings."
      );
    }
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  const requireVerif = settings?.requireEmailVerification === true;
  // The default host is "localhost" -- a fresh server that has never been
  // given a real mail server.
  const host = settings?.emailServer?.host;
  const emailReady = !!host && host !== "localhost";

  async function toggleVerif(next) {
    setSaving(true);
    setError(null);
    setSettings((s) => ({ ...s, requireEmailVerification: next }));
    try {
      await client.admin.updateSetting({ settingId: "requireEmailVerification", value: next });
    } catch (e) {
      setSettings((s) => ({ ...s, requireEmailVerification: !next }));
      setError(e?.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const openWeb = () => {
    const base = (client?.admin?.http?.baseUrl || "").replace(/\/$/, "");
    if (base) Linking.openURL(`${base}/admin/settings`);
  };

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="Settings" />
      {!settings && !error ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}>
          {error ? <Text className="font-ui text-sm text-error pt-4">{error}</Text> : null}

          {settings ? (
            <>
              <View className="border-b-2 border-base-300 pb-2 mt-4 mb-1">
                <Text className="font-reading text-2xl text-base-content">New members</Text>
              </View>
              <View className="flex-row items-center py-3 border-b border-base-200">
                <View className="flex-1 min-w-0 mr-3">
                  <Text className="font-ui text-base text-base-content">Confirm email address</Text>
                  <Text className="font-ui text-xs text-base-content/50 mt-0.5">
                    New members get a link by email and can't sign in until they open it.
                  </Text>
                </View>
                <Switch
                  value={requireVerif}
                  onValueChange={toggleVerif}
                  disabled={saving}
                  accessibilityLabel="Confirm email address"
                />
              </View>
              {requireVerif && !emailReady ? (
                <Text className="font-ui text-sm text-error py-3">
                  This server can't send email yet, so new members won't get their link. Set up email on the web
                  first.
                </Text>
              ) : null}
            </>
          ) : null}

          <Pressable onPress={openWeb} className="flex-row items-center mt-8">
            <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/60 mr-2">
              Name, rules, email and backups -- on the web
            </Text>
            <ExternalLink size={12} color={ink(0.45)} strokeWidth={1.75} />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
