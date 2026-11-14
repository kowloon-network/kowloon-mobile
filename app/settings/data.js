// Download your data.
//
// Asks the server for a zip of everything this account made (built in the
// background by the server's worker), shows progress, then opens the signed
// download link in the system browser, which saves the file. No native file
// handling needed, and big media exports never pass through the app.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../src/components/ui/Button.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const dateFmt = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : "";

export default function DownloadData() {
  const router = useRouter();
  const client = useActiveClient();

  const [exp, setExp] = useState(undefined); // undefined = loading, null = none
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const building = exp && (exp.status === "pending" || exp.status === "running");

  const refresh = useCallback(() => {
    if (!client) return Promise.resolve();
    return client.auth.getDataExport().then(setExp).catch(() => setExp((e) => e ?? null));
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!building) return undefined;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [building, refresh]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setExp(await client.auth.requestDataExport());
    } catch (e) {
      setError(e?.message || "Couldn't start the download.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setError(null);
    try {
      // Fetch a fresh link: the one we hold is only good for an hour.
      const fresh = await client.auth.getDataExport();
      setExp(fresh);
      if (fresh?.downloadUrl) await Linking.openURL(fresh.downloadUrl);
    } catch (e) {
      setError(e?.message || "Couldn't open the download.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right", "bottom"]}>
      <AppHeader back title="Your Data" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Text className="font-ui text-base text-base-content/80 leading-6 mb-6">
          Get a copy of everything you've made here, as a zip file: your profile, posts,
          replies, circles, bookmarks, reactions and every photo, video and file you
          uploaded. Your posts come as a page you can read in any browser. It can take a
          few minutes; we'll email you when it's ready.
        </Text>

        {exp === undefined ? <ActivityIndicator /> : null}

        {building ? (
          <View className="flex-row items-center mb-4">
            <ActivityIndicator />
            <Text className="font-ui text-sm text-base-content/60 ml-3">
              Preparing your copy{exp.stage ? `: ${exp.stage}` : "…"}
            </Text>
          </View>
        ) : null}

        {exp?.status === "done" ? (
          <View className="bg-base-200 px-4 py-3 mb-4" style={{ borderLeftWidth: 4 }}>
            <Text className="font-ui text-base text-base-content">
              Ready{exp.sizeBytes ? ` (${formatSize(exp.sizeBytes)})` : ""}
            </Text>
            <Text className="font-ui text-xs text-base-content/60 mt-1">
              Made {dateFmt(exp.readyAt)}. Available until {dateFmt(exp.expiresAt)}.
            </Text>
          </View>
        ) : null}

        {exp?.status === "failed" ? (
          <Text className="font-ui text-sm text-error mb-4">
            The last copy couldn't be made.{exp.error ? ` (${exp.error})` : ""}
          </Text>
        ) : null}
      </ScrollView>

      <View className="px-6 pt-3 pb-2 bg-base-100">
        {error ? <Text className="font-ui text-sm text-error mb-3">{error}</Text> : null}
        {exp?.status === "done" ? (
          <Pressable
            onPress={download}
            className="bg-primary items-center justify-center h-12 mb-3"
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
          >
            <Text className="font-ui uppercase tracking-[0.14em] text-sm text-primary-content">
              Download
            </Text>
          </Pressable>
        ) : null}
        {!building && exp !== undefined ? (
          <Pressable
            onPress={busy ? undefined : start}
            disabled={busy}
            className={`${exp?.status === "done" ? "border border-base-content/30" : "bg-primary"} items-center justify-center h-12 mb-3`}
            style={{ opacity: busy ? 0.5 : 1 }}
          >
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text
                className={`font-ui uppercase tracking-[0.14em] text-sm ${exp?.status === "done" ? "text-base-content" : "text-primary-content"}`}
              >
                {exp?.status === "done" ? "Make a New Copy" : "Prepare My Download"}
              </Text>
            )}
          </Pressable>
        ) : null}
        <Button label="Done" variant="ghost" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}
