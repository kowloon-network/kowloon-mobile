// Admin home -- same order as the web dashboard (frontend AdminDashboardPage):
//   1. Your community: the four numbers an admin actually watches
//   2. Moderation: open reports, each opening its report screen
//   3. Create new: quick actions
//   4. Sections, with a one-line description each
//   5. Server health, collapsed
//   6. A pointer to the admin guide
// Gated: reachable only from the admin entry (drawer / user menu), which shows
// only for server admins; the server also 403s every /admin/* call.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Circle,
  Compass,
  ExternalLink,
  FileText,
  Flag,
  Mail,
  Palette,
  ScrollText,
  Settings,
  Users,
  Users2,
} from "lucide-react-native";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { ReportsList } from "../../src/components/admin/ReportsList.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useIsAdmin } from "../../src/lib/useIsAdmin.js";
import { useInk } from "../../src/lib/useInk.js";

const REPORTS_SHOWN = 5;
const GUIDE_URL = "https://kowloon.network/docs/admin/quick-start/";

// `web` sections have no screen in the app yet; they open the web admin.
const SECTIONS = [
  {
    label: "Manage",
    items: [
      { route: "/admin/moderation", label: "Moderation", desc: "Reports, and blocking other servers", Icon: Flag },
      { route: "/admin/users", label: "Users", desc: "Find, add, close or restore accounts", Icon: Users },
      { route: "/admin/posts", label: "Posts", desc: "Every post on the server", Icon: FileText },
      { route: "/admin/circles", label: "Circles", desc: "Members' circles", Icon: Circle },
      { route: "/admin/groups", label: "Groups", desc: "Groups and who runs them", Icon: Users2 },
    ],
  },
  {
    label: "Community",
    items: [
      { web: "/admin/discovery", label: "Discover", desc: "What newcomers see first", Icon: Compass },
      { route: "/admin/pages", label: "Pages", desc: "About, rules, schedules and the like", Icon: BookOpen },
      { route: "/admin/bookmarks", label: "Bookmarks", desc: "The server's shared links", Icon: Bookmark },
    ],
  },
  {
    label: "System",
    items: [
      { route: "/admin/invites", label: "Invites", desc: "Links and QR codes for joining", Icon: Mail },
      { route: "/admin/themes", label: "Themes", desc: "The server's colours", Icon: Palette },
      { web: "/admin/settings", label: "Settings", desc: "Name, email, rules, backups", Icon: Settings },
      { web: "/admin/logs", label: "Logs", desc: "Technical errors and warnings", Icon: ScrollText },
    ],
  },
];

const QUICK_ACTIONS = [
  { route: "/admin/invites", label: "Invite", Icon: Mail },
  { route: "/admin/page/new", label: "Page", Icon: BookOpen },
  { route: "/admin/bookmark/new", label: "Bookmark", Icon: Bookmark },
];

function fmtKb(n) {
  if (n == null) return "--";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} MB`;
  return `${n} KB`;
}

function fmtUptime(s) {
  if (s == null) return "--";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtNum(v) {
  return typeof v === "number" ? v.toLocaleString() : "--";
}

// `onAction` adds an arrow at the right that opens the section's full screen;
// `actionLabel` (optional) sits beside the arrow.
function SectionTitle({ children, onAction, actionLabel, first = false }) {
  const ink = useInk();
  return (
    <View
      className={`flex-row items-center justify-between border-b-2 border-base-300 pb-2 mb-1 ${first ? "mt-4" : "mt-8"}`}
    >
      <Text className="font-reading text-2xl text-base-content">{children}</Text>
      {onAction ? (
        <Pressable onPress={onAction} hitSlop={10} className="flex-row items-center" accessibilityRole="link">
          {actionLabel ? (
            <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/70 mr-1.5">
              {actionLabel}
            </Text>
          ) : null}
          <ArrowRight size={22} color={ink(0.75)} strokeWidth={1.75} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Tile({ label, value, sub, onPress }) {
  return (
    <View className="w-1/2 p-1">
      <Pressable onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.05)" }} className="bg-base-200 px-4 py-3">
        <Text className="font-ui text-3xl font-bold text-base-content">{fmtNum(value)}</Text>
        <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/50 mt-1">{label}</Text>
        {sub ? <Text className="font-ui text-xs text-base-content/50 mt-0.5">{sub}</Text> : null}
      </Pressable>
    </View>
  );
}

function HealthRow({ label, value }) {
  return (
    <View className="flex-row items-baseline justify-between py-2 border-b border-base-200">
      <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/50 mr-3">{label}</Text>
      <Text numberOfLines={1} className="font-ui text-sm text-base-content flex-shrink text-right">
        {value ?? "--"}
      </Text>
    </View>
  );
}

function HealthGroup({ title, children }) {
  return (
    <View className="mt-3">
      <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/40 mb-1">{title}</Text>
      {children}
    </View>
  );
}

export default function AdminHome() {
  const router = useRouter();
  const client = useActiveClient();
  const isAdmin = useIsAdmin();
  const ink = useInk();

  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [healthOpen, setHealthOpen] = useState(false);

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [s, r] = await Promise.all([
          client.admin.serverStats(),
          client.admin
            .getFlagged({ status: "open", limit: REPORTS_SHOWN })
            .catch(() => null),
        ]);
        setStats(s || null);
        setReports(
          r ? { items: r.orderedItems || r.items || [], total: r.totalItems ?? 0 } : { items: [], total: 0, failed: true }
        );
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load the dashboard."
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

  const openWeb = (path) => {
    const base = (client?.admin?.http?.baseUrl || "").replace(/\/$/, "");
    if (base) Linking.openURL(`${base}${path}`);
  };

  const c = stats?.counts || {};
  const a = stats?.activity || {};
  const m = stats?.media || {};
  const srv = stats?.server || {};
  const db = stats?.database || {};
  const disk = stats?.disk || null;
  const diskTight = disk?.usedPct != null && disk.usedPct >= 85;
  const openTotal = reports?.total ?? c.openFlags ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="Server Admin" />

      {!isAdmin && !loading ? (
        <View className="px-6 py-20 items-center">
          <Text className="font-ui text-base text-base-content/70 text-center">
            You don't have admin access on this server.
          </Text>
        </View>
      ) : loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Text className="font-ui text-sm text-error px-5 py-6">{error}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />}
        >
          {diskTight ? (
            <View className="flex-row items-start border-2 border-warning bg-warning/10 px-4 py-3 mt-4">
              <AlertTriangle size={18} color={ink(0.7)} strokeWidth={1.75} />
              <Text className="font-ui text-sm text-base-content ml-3 flex-1">
                The server's disk is {disk.usedPct}% full. Tell whoever looks after the server before uploads start
                failing.
              </Text>
            </View>
          ) : null}

          {/* 1. Your community */}
          <SectionTitle first>Your community</SectionTitle>
          <View className="flex-row flex-wrap -mx-1 mt-1">
            <Tile
              label="Members"
              value={c.users}
              sub={a.newUsersWeek != null ? `${a.newUsersWeek} new this week` : null}
              onPress={() => router.push("/admin/users")}
            />
            <Tile
              label="Posts today"
              value={a.postsToday}
              sub={c.posts != null ? `${fmtNum(c.posts)} in all` : null}
              onPress={() => router.push("/admin/posts")}
            />
            <Tile label="Groups" value={c.groups} onPress={() => router.push("/admin/groups")} />
            <Tile
              label="Invites"
              value={c.activeInvites}
              sub={a.invitesUsed != null ? `active -- ${a.invitesUsed} used` : "active"}
              onPress={() => router.push("/admin/invites")}
            />
          </View>

          {/* 2. Moderation */}
          <SectionTitle
            onAction={() => router.push("/admin/moderation")}
            actionLabel={openTotal > REPORTS_SHOWN ? `${openTotal} open` : null}
          >
            Moderation
          </SectionTitle>
          {reports?.failed ? (
            <Text className="font-ui text-sm text-error py-3">Couldn't load reports.</Text>
          ) : (
            <ReportsList flags={reports?.items || []} empty="No open reports." />
          )}

          {/* 3. Quick actions */}
          <SectionTitle>Create new</SectionTitle>
          <View className="flex-row mt-2" style={{ gap: 8 }}>
            {QUICK_ACTIONS.map(({ route, label, Icon }) => (
              <Pressable
                key={label}
                onPress={() => router.push(route)}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className="flex-1 items-center py-3 border-2 border-base-300"
              >
                <Icon size={18} color={ink(0.6)} strokeWidth={1.75} />
                <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/70 mt-1">
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 4. Sections */}
          {SECTIONS.map((group) => (
            <View key={group.label}>
              <SectionTitle>{group.label}</SectionTitle>
              {group.items.map(({ route, web, label, desc, Icon }) => (
                <Pressable
                  key={label}
                  onPress={() => (web ? openWeb(web) : router.push(route))}
                  android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                  className="flex-row items-center py-3 border-b border-base-200"
                >
                  <Icon size={20} color={ink(0.6)} strokeWidth={1.75} />
                  <View className="flex-1 min-w-0 ml-3">
                    <Text className="font-ui text-base text-base-content">{label}</Text>
                    <Text numberOfLines={1} className="font-ui text-xs text-base-content/50 mt-0.5">
                      {web ? `${desc} -- opens on the web` : desc}
                    </Text>
                  </View>
                  {web ? (
                    <ExternalLink size={16} color={ink(0.35)} strokeWidth={1.75} />
                  ) : (
                    <ChevronRight size={18} color={ink(0.35)} strokeWidth={1.75} />
                  )}
                </Pressable>
              ))}
            </View>
          ))}

          {/* 5. Server health, collapsed */}
          <View className="mt-8 border-2 border-base-300">
            <Pressable
              onPress={() => setHealthOpen((o) => !o)}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              className="flex-row items-center px-4 py-3"
            >
              <View className="flex-1">
                <Text className="font-reading text-xl text-base-content">Server health</Text>
                <Text className="font-ui text-xs text-base-content/50">
                  {disk ? `Disk ${disk.usedPct}% used` : "Storage"} -- up {fmtUptime(srv.uptimeSeconds)}
                </Text>
              </View>
              {healthOpen ? (
                <ChevronDown size={18} color={ink(0.4)} strokeWidth={1.75} />
              ) : (
                <ChevronRight size={18} color={ink(0.4)} strokeWidth={1.75} />
              )}
            </Pressable>
            {healthOpen ? (
              <View className="px-4 pb-4">
                <HealthGroup title="Storage">
                  {disk ? (
                    <HealthRow
                      label="Disk"
                      value={`${fmtKb(disk.usedKb)} of ${fmtKb(disk.totalKb)} (${disk.usedPct}%)`}
                    />
                  ) : null}
                  <HealthRow label="Media" value={`${fmtNum(m.totalFiles)} files, ${fmtKb(m.totalSizeKb)}`} />
                  <HealthRow label="Photos / videos" value={`${fmtNum(m.photos)} / ${fmtNum(m.videos)}`} />
                  <HealthRow label="Audio / documents" value={`${fmtNum(m.audio)} / ${fmtNum(m.documents)}`} />
                  <HealthRow label="Database" value={fmtKb(db.storageKb)} />
                </HealthGroup>
                <HealthGroup title="Machine">
                  <HealthRow label="Uptime" value={fmtUptime(srv.uptimeSeconds)} />
                  <HealthRow
                    label="Memory free"
                    value={srv.memoryMb ? `${srv.memoryMb.free} of ${srv.memoryMb.total} MB` : null}
                  />
                  <HealthRow
                    label="Server process"
                    value={srv.memoryMb?.processHeap != null ? `${srv.memoryMb.processHeap} MB` : null}
                  />
                  <HealthRow label="Node" value={srv.nodeVersion} />
                  <HealthRow label="Platform" value={srv.platform ? `${srv.platform}/${srv.arch}` : null} />
                </HealthGroup>
                <HealthGroup title="Totals">
                  <HealthRow label="Replies" value={fmtNum(c.replies)} />
                  <HealthRow label="Reactions" value={fmtNum(c.reacts)} />
                  <HealthRow label="Pages" value={fmtNum(c.pages)} />
                  <HealthRow
                    label="New members (month / year)"
                    value={`${fmtNum(a.newUsersMonth)} / ${fmtNum(a.newUsersYear)}`}
                  />
                </HealthGroup>
              </View>
            ) : null}
          </View>

          {/* 6. Guide */}
          <Pressable onPress={() => Linking.openURL(GUIDE_URL)} className="flex-row items-center mt-8">
            <Compass size={14} color={ink(0.55)} strokeWidth={1.75} />
            <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/60 mx-2">
              New to running a server? Read the guide
            </Text>
            <ExternalLink size={12} color={ink(0.45)} strokeWidth={1.75} />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
