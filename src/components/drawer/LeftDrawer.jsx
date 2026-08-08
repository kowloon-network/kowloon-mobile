// LeftDrawer — slides in from the left as a full-height Modal panel.
//
// Layout (top to bottom inside the scroll):
//   ServerInfo   — hero image / description / location
//   SearchBar    — searches the server, navigates to /search?q=…
//   PagesMenu    — server pages with collapsible twisties for subpages
//   PopularCircles
//   ActiveGroups

import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react-native";

import { useActiveClient } from "../../lib/useActiveClient.js";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";
import { useIsAdmin } from "../../lib/useIsAdmin.js";
import { useInk } from "../../lib/useInk.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";

const DRAWER_WIDTH_PCT = 0.85;

function SectionHeader({ children }) {
  return (
    <Text className="font-ui text-2xl text-base-content leading-none mb-3">
      {children}
    </Text>
  );
}

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ── ServerInfo ──────────────────────────────────────────────────────────────

function ServerInfoSection({ client }) {
  const [info, setInfo] = useState(null);
  const [heroFailed, setHeroFailed] = useState(false);
  const baseUrl = client?.http?.baseUrl;
  const ink = useInk();

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds
      .getServerInfo()
      .then((res) => {
        if (!cancelled) setInfo(res || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!info) return null;
  const heroSrc = resolveImageUrl(info.image || info.icon, baseUrl);
  const description = info.description;
  const location = info.settings?.profile?.location;
  const serverName = info.name;
  const hasHero = heroSrc && !heroFailed;
  const hasContent = hasHero || serverName || description || location?.name;

  if (!hasContent) return null;

  return (
    <View className="  pb-5 mb-5">
      {hasHero ? (
        <View className="-mt-5 -mx-5 mb-4">
          <Image
            source={{ uri: heroSrc }}
            className="w-full bg-base-200"
            style={{ aspectRatio: 16 / 9 }}
            resizeMode="cover"
            onError={() => setHeroFailed(true)}
          />
        </View>
      ) : serverName ? (
        <View
          className="-mt-5 -mx-5 mb-4 items-center justify-center bg-secondary px-6"
          style={{ aspectRatio: 16 / 9 }}
        >
          <Text
            className="font-ui text-4xl text-secondary-content text-center leading-tight"
            numberOfLines={3}
          >
            {serverName}
          </Text>
        </View>
      ) : null}
      {description ? (
        <Text className="font-ui text-sm text-base-content/80 leading-relaxed mb-3">
          {stripHtml(description)}
        </Text>
      ) : null}
      {location?.name ? (
        <View className="flex-row items-center">
          <MapPin size={13} color={ink(0.55)} strokeWidth={1.75} />
          <Text className="font-ui text-xs uppercase tracking-[0.16em] text-base-content/55 ml-1.5 flex-1">
            {location.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── SearchBar ────────────────────────────────────────────────────────────────

function SearchBar({ onNavigate }) {
  const [query, setQuery] = useState("");
  const ink = useInk();

  function handleSubmit() {
    const q = query.trim();
    if (!q) return;
    setQuery("");
    onNavigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <View className="  pb-5 mb-5">
      <View className="flex-row items-center   bg-field px-3">
        <Search size={15} color={ink(0.4)} strokeWidth={1.75} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          placeholder="Search this server…"
          placeholderTextColor={ink(0.35)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 font-ui text-sm text-base-content py-2.5 ml-2"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <X size={15} color={ink(0.4)} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── PagesMenu ────────────────────────────────────────────────────────────────
// Subpages are hidden behind a twistie chevron.
// Tapping the page title navigates; tapping the chevron toggles the children.

function PagesMenuSection({ client, onNavigate }) {
  const [pages, setPages] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const ink = useInk();

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds.http
      .get("/pages", { params: { limit: 50 } })
      .then((res) => {
        if (cancelled) return;
        const items = res?.orderedItems || res?.items || [];
        const top = items.filter((p) => !p.parentId);
        const tree = top.map((p) => ({
          ...p,
          children: items.filter((c) => c.parentId === p.id),
        }));
        setPages(tree);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!pages.length) return null;

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <View className="  pb-5 mb-5">
      <SectionHeader>Pages</SectionHeader>
      {pages.map((page) => {
        const hasChildren = page.children?.length > 0;
        const isOpen = expanded.has(page.id);

        return (
          <View key={page.id}>
            <View className="flex-row items-center py-2">
              {/* Title — always navigates to this page */}
              <Pressable
                onPress={() =>
                  onNavigate(
                    `/pages/${encodeURIComponent(page.slug || page.id)}`
                  )
                }
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="flex-1 mr-2"
              >
                <Text className="font-ui text-sm uppercase tracking-[0.16em] text-base-content/80">
                  {page.title || page.name}
                </Text>
              </Pressable>
              {/* Chevron — toggles subpages without navigating */}
              {hasChildren ? (
                <Pressable
                  onPress={() => toggle(page.id)}
                  hitSlop={10}
                  android_ripple={{
                    color: "rgba(0,0,0,0.06)",
                    borderless: true,
                  }}
                >
                  {isOpen ? (
                    <ChevronDown
                      size={14}
                      color={ink(0.55)}
                      strokeWidth={1.75}
                    />
                  ) : (
                    <ChevronRight
                      size={14}
                      color={ink(0.55)}
                      strokeWidth={1.75}
                    />
                  )}
                </Pressable>
              ) : null}
            </View>

            {hasChildren && isOpen ? (
              <View className="  ml-2 mb-1">
                {page.children.map((child) => (
                  <Pressable
                    key={child.id}
                    onPress={() =>
                      onNavigate(
                        `/pages/${encodeURIComponent(child.slug || child.id)}`
                      )
                    }
                    android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                    className="py-1.5 pl-3"
                  >
                    <Text className="font-ui text-sm uppercase tracking-[0.16em] text-base-content/65">
                      {child.title || child.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Discover (Circles + Groups) ─────────────────────────────────────────────

function ItemAvatar({ item, baseUrl }) {
  const [failed, setFailed] = useState(false);
  const icon = resolveImageUrl(item?.icon, baseUrl);
  if (icon && !failed) {
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: 36, height: 36 }}
        className="  bg-base-200"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{ width: 36, height: 36 }}
      className="  bg-secondary items-center justify-center"
    >
      <Users size={18} color="rgba(255,244,224,0.7)" strokeWidth={1.75} />
    </View>
  );
}

function SubHeading({ children }) {
  return (
    <Text className="font-ui text-[11px] uppercase tracking-[0.18em] text-base-content/50 mb-1">
      {children}
    </Text>
  );
}

function MoreLink({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      className="mt-2 mb-1"
    >
      <Text className="font-ui text-[11px] uppercase tracking-[0.18em] text-primary">
        {label}
      </Text>
    </Pressable>
  );
}

function DiscoverSection({ client, onNavigate }) {
  const [circles, setCircles] = useState([]);
  const [groups, setGroups] = useState([]);
  const baseUrl = client?.http?.baseUrl;

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds
      .getCircles({ sort: "reacts", limit: 5 })
      .then((res) => {
        if (!cancelled) setCircles(res?.orderedItems || res?.items || []);
      })
      .catch(() => {});
    client.feeds
      .getGroups({ limit: 5 })
      .then((res) => {
        if (!cancelled) setGroups(res?.orderedItems || res?.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!circles.length && !groups.length) return null;

  return (
    <View className="pb-2">
      <SectionHeader>Discover</SectionHeader>

      {circles.length > 0 ? (
        <View className="mb-5">
          <SubHeading>Circles</SubHeading>
          {circles.map((circle) => (
            <Pressable
              key={circle.id}
              onPress={() =>
                onNavigate(`/circle/${encodeURIComponent(circle.id)}`)
              }
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="flex-row items-start py-3  "
            >
              <ItemAvatar item={circle} baseUrl={baseUrl} />
              <View className="flex-1 ml-3 min-w-0">
                <Text
                  className="font-ui text-base text-base-content leading-tight"
                  numberOfLines={1}
                >
                  {circle.name}
                </Text>
                {circle.memberCount > 0 ? (
                  <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/55 mt-0.5">
                    {circle.memberCount} members
                  </Text>
                ) : null}
                {circle.summary ? (
                  <Text
                    className="font-ui text-xs text-base-content/70 leading-snug mt-1"
                    numberOfLines={2}
                  >
                    {stripHtml(circle.summary)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          <MoreLink label="More Circles…" onPress={() => onNavigate("/browse-circles")} />
        </View>
      ) : null}

      {groups.length > 0 ? (
        <View>
          <SubHeading>Groups</SubHeading>
          {/* Dedupe by id — the source can list the same group twice, which
              collides React keys. */}
          {Array.from(new Map(groups.map((g) => [g.id, g])).values()).map((group) => (
            <Pressable
              key={group.id}
              onPress={() =>
                onNavigate(`/group/${encodeURIComponent(group.id)}`)
              }
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="flex-row items-start py-3  "
            >
              <ItemAvatar item={group} baseUrl={baseUrl} />
              <View className="flex-1 ml-3 min-w-0">
                <Text
                  className="font-ui text-base text-base-content leading-tight"
                  numberOfLines={1}
                >
                  {group.name}
                </Text>
                <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/55 mt-0.5">
                  {(group.memberCount || 0).toLocaleString()} members
                </Text>
              </View>
            </Pressable>
          ))}
          <MoreLink label="More Groups…" onPress={() => onNavigate("/groups?tab=browse")} />
        </View>
      ) : null}
    </View>
  );
}

// ── LeftDrawer ──────────────────────────────────────────────────────────────

export function LeftDrawer({ visible, onClose }) {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const panelWidth = Math.round(screenWidth * DRAWER_WIDTH_PCT);
  const [serverIcon, setServerIcon] = useState(null);
  const isAdmin = useIsAdmin();
  const ink = useInk();

  // Server icon for the header, matching the feed masthead.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.feeds
      .getServerInfo()
      .then((info) => {
        if (!cancelled && info?.icon) {
          setServerIcon(resolveImageUrl(info.icon, client?.http?.baseUrl));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  function navigate(path) {
    onClose();
    router.push(path);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 flex-row">
        {/* Dark status-bar icons while the drawer is open (the white header
            fills the status-bar area; the app's light-on-blue icons would
            vanish on white). Reverts to the app default when the drawer closes. */}
        <StatusBar style="dark" />
        {/* Panel */}
        <SafeAreaView
          edges={["left", "bottom"]}
          style={{ width: panelWidth }}
          className="bg-base-100  "
        >
          {/* Header — white, with the server icon + title (matching the app top
              bar's size/formatting, in black). paddingTop fills the status-bar
              area so the drawer never sits under it (issue 33). */}
          <View
            className="bg-base-100 border-b border-base-200 px-5 pb-3 flex-row items-center"
            style={{ paddingTop: insets.top + 8 }}
          >
            <View className="w-6 h-6 items-center justify-center overflow-hidden mr-2.5 bg-base-200">
              {serverIcon ? (
                <Image
                  source={{ uri: serverIcon }}
                  style={{ width: 24, height: 24 }}
                  resizeMode="cover"
                />
              ) : (
                <Globe size={15} color={ink(0.7)} strokeWidth={1.75} />
              )}
            </View>
            <Text
              className="font-ui text-xl tracking-tight text-base-content flex-1"
              numberOfLines={1}
            >
              {account?.serverName || account?.server || "Menu"}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
            >
              <X size={20} color={ink(0.7)} strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <ServerInfoSection client={client} />
            <SearchBar onNavigate={navigate} />
            <PagesMenuSection client={client} onNavigate={navigate} />
            <DiscoverSection client={client} onNavigate={navigate} />
            {isAdmin ? (
              <Pressable
                onPress={() => navigate("/admin")}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className="flex-row items-center mt-4 pt-4 border-t border-base-200"
              >
                <Shield size={18} color={ink(0.7)} strokeWidth={1.75} />
                <Text className="font-ui uppercase tracking-[0.16em] text-xs text-base-content ml-2.5">
                  Server Admin
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>

        {/* Backdrop */}
        <Pressable onPress={onClose} className="flex-1 bg-black/40" />
      </View>
    </Modal>
  );
}
