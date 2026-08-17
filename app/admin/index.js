// Admin home — server stats at a glance + navigation into the admin sections.
// Gated: reachable only from the admin entry (drawer / user menu), which shows
// only for server admins; the server also 403s every /admin/* call.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronRight,
  Flag,
  Users,
  Mail,
  FileText,
  Users2,
  Circle,
} from "lucide-react-native";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useIsAdmin } from "../../src/lib/useIsAdmin.js";
import { useInk } from "../../src/lib/useInk.js";

const STAT_FIELDS = [
  { key: "users", label: "Users" },
  { key: "posts", label: "Posts" },
  { key: "groups", label: "Groups" },
  { key: "circles", label: "Circles" },
  { key: "pages", label: "Pages" },
  { key: "openFlags", label: "Open flags" },
  { key: "activeInvites", label: "Invites" },
  { key: "reacts", label: "Reacts" },
];

function StatCard({ label, value }) {
  return (
    <View className="w-1/2 p-1">
      <View className="bg-base-200 px-4 py-3">
        <Text className="font-ui text-2xl font-bold text-base-content">
          {typeof value === "number" ? value.toLocaleString() : "—"}
        </Text>
        <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/50 mt-0.5">
          {label}
        </Text>
      </View>
    </View>
  );
}

function NavRow({ icon, label, sublabel, badge, onPress }) {
  const ink = useInk();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-center px-5 py-4 border-b border-base-200"
    >
      <View className="mr-3">{icon}</View>
      <View className="flex-1 min-w-0">
        <Text className="font-ui text-base text-base-content">{label}</Text>
        {sublabel ? (
          <Text className="font-ui text-xs text-base-content/50 mt-0.5">
            {sublabel}
          </Text>
        ) : null}
      </View>
      {typeof badge === "number" && badge > 0 ? (
        <View className="bg-error min-w-[22px] h-5 items-center justify-center px-1.5 mr-2">
          <Text className="font-ui text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={ink(0.35)} strokeWidth={1.75} />
    </Pressable>
  );
}

export default function AdminHome() {
  const router = useRouter();
  const client = useActiveClient();
  const isAdmin = useIsAdmin();
  const ink = useInk();

  const [stats, setStats] = useState(null);
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
        const res = await client.admin.serverStats();
        setStats(res || null);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load server stats."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client]
  );

  useEffect(() => {
    load();
  }, [load]);

  const counts = stats?.counts || {};

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="Server Admin" />

      {!isAdmin && !loading ? (
        <View className="px-6 py-20 items-center">
          <Text className="font-ui text-base text-base-content/70 text-center">
            You don't have admin access on this server.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 96 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ isRefresh: true })}
            />
          }
        >
          {/* Stats */}
          <View className="px-4 pt-4 pb-2">
            {loading ? (
              <View className="py-10 items-center">
                <ActivityIndicator />
              </View>
            ) : error ? (
              <Text className="font-ui text-sm text-error px-1 py-3">
                {error}
              </Text>
            ) : (
              <View className="flex-row flex-wrap -m-1">
                {STAT_FIELDS.map((f) => (
                  <StatCard key={f.key} label={f.label} value={counts[f.key]} />
                ))}
              </View>
            )}
          </View>

          {/* Sections */}
          <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/45 px-5 pt-4 pb-2">
            Manage
          </Text>
          <NavRow
            icon={<Flag size={20} color="#CC272E" strokeWidth={1.75} />}
            label="Moderation"
            sublabel="Review reports and flags"
            badge={counts.openFlags}
            onPress={() => router.push("/admin/moderation")}
          />
          <NavRow
            icon={<Users size={20} color={ink(0.7)} strokeWidth={1.75} />}
            label="Users"
            sublabel="Deactivate, restore, roles"
            onPress={() => router.push("/admin/users")}
          />
          <NavRow
            icon={<FileText size={20} color={ink(0.7)} strokeWidth={1.75} />}
            label="Posts"
            sublabel="Server announcements"
            onPress={() => router.push("/admin/posts")}
          />
          <NavRow
            icon={<Users2 size={20} color={ink(0.7)} strokeWidth={1.75} />}
            label="Groups"
            sublabel="Create and manage groups"
            onPress={() => router.push("/admin/groups")}
          />
          <NavRow
            icon={<Circle size={20} color={ink(0.7)} strokeWidth={1.75} />}
            label="Circles"
            sublabel="Create and manage circles"
            onPress={() => router.push("/admin/circles")}
          />
          <NavRow
            icon={<Mail size={20} color={ink(0.7)} strokeWidth={1.75} />}
            label="Invites"
            sublabel="Create and manage invites"
            onPress={() => router.push("/admin/invites")}
          />
          <NavRow
            icon={<FileText size={20} color={ink(0.7)} strokeWidth={1.75} />}
            label="Pages"
            sublabel="Create and edit content pages"
            onPress={() => router.push("/admin/pages")}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
