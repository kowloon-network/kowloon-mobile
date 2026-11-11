// Admin moderation -- a top switch between the report queue (filtered by
// status; each report opens app/admin/report/[id].js, which holds the
// actions), the server's Blocked and Defederated lists, and banned emails.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { ReportsList } from "../../src/components/admin/ReportsList.jsx";
import { BlocklistView } from "../../src/components/admin/BlocklistView.jsx";
import { BannedEmailsView } from "../../src/components/admin/BannedEmailsView.jsx";

const SECTIONS = [
  { key: "reports", label: "Reports" },
  { key: "blocked", label: "Blocked" },
  { key: "defederated", label: "Defederated" },
  { key: "emails", label: "Emails" },
];

const STATUSES = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

export default function Moderation() {
  const client = useActiveClient();

  const [section, setSection] = useState("reports");
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (nextStatus, { isRefresh = false } = {}) => {
      if (!client) return;
      const s = nextStatus ?? status;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.admin.getFlagged({ status: s });
        setItems(res?.orderedItems || res?.items || []);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load the moderation queue."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client, status]
  );

  useEffect(() => {
    load(status);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = status === "open";

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="Moderation" />

      {/* Section switch */}
      <View className="flex-row bg-base-200">
        {SECTIONS.map((sec) => {
          const active = section === sec.key;
          return (
            <Pressable
              key={sec.key}
              onPress={() => setSection(sec.key)}
              className={`flex-1 items-center py-3 ${active ? "bg-secondary" : ""}`}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            >
              <Text
                numberOfLines={1}
                className={`font-ui uppercase tracking-[0.12em] text-[10px] ${
                  active ? "text-secondary-content" : "text-base-content/55"
                }`}
              >
                {sec.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {section === "blocked" || section === "defederated" ? (
        <BlocklistView key={section} list={section} />
      ) : section === "emails" ? (
        <BannedEmailsView />
      ) : (
      <>
      {/* Status tabs */}
      <View className="flex-row border-b border-base-200">
        {STATUSES.map((s) => {
          const active = status === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setStatus(s.key)}
              className={`flex-1 items-center py-3 ${active ? "border-b-2 border-primary" : ""}`}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            >
              <Text
                className={`font-ui uppercase tracking-[0.14em] text-[11px] ${
                  active ? "text-base-content" : "text-base-content/45"
                }`}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(status, { isRefresh: true })}
          />
        }
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="font-ui text-sm text-error px-5 py-6">{error}</Text>
        ) : (
          <View className="px-5 pt-2">
            <ReportsList
              flags={items}
              showReason
              showStatus={!isOpen}
              empty={isOpen ? "No open reports -- all clear." : `No ${status} reports.`}
            />
          </View>
        )}
      </ScrollView>
      </>
      )}
    </SafeAreaView>
  );
}
