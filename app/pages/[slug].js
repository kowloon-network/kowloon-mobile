// Page detail — server-authored content page (about, rules, etc.).
//
// Linked from the LeftDrawer's PagesMenu. Reading typography applies to the
// body the same way it does on a post detail.

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Link2, Share2, Tag, X } from "lucide-react-native";

import { Avatar } from "../../src/components/posts/Avatar.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { Button } from "../../src/components/ui/Button.jsx";
import { Eyebrow } from "../../src/components/ui/Heading.jsx";
import { HtmlContent } from "../../src/components/HtmlContent.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useTypography } from "../../src/lib/TypographyContext.js";
import { timeAgo } from "../../src/lib/timeAgo.js";

// Resolve the page's `image` field to a displayable URL — handles file IDs
// (`file:abc@domain`), absolute /files/ paths, and full URLs.
function resolvePageImage(img, client) {
  if (!img) return null;
  if (typeof img !== "string") return null;
  if (img.startsWith("file:")) return client?.files?.serveUrl?.(img) || null;
  const m = img.match(/\/files\/(file:[^?#]+)/);
  if (m) return client?.files?.serveUrl?.(decodeURIComponent(m[1])) || img;
  if (/^https?:\/\//i.test(img)) return img;
  const baseUrl = client?.http?.baseUrl;
  if (baseUrl) return `${baseUrl.replace(/\/$/, "")}/${img.replace(/^\//, "")}`;
  return img;
}

export default function PageDetail() {
  const router = useRouter();
  const { slug } = useLocalSearchParams();
  const client = useActiveClient();
  const { resolved } = useTypography();

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    if (!client || !slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.feeds.getPage({
        pageId: decodeURIComponent(String(slug)),
      });
      setPage(res?.item || res?.page || res || null);
    } catch (e) {
      setError(e?.message || "Couldn't load this page.");
    } finally {
      setLoading(false);
    }
  }, [client, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const author = page?.actor || null;
  const imageSrc = resolvePageImage(page?.image, client);
  const updatedAt = page?.updatedAt && page.updatedAt !== page.createdAt
    ? page.updatedAt
    : null;

  // Public URL for this page — used by both share paths.
  const baseUrl = client?.http?.baseUrl;
  const pageUrl =
    page?.url ||
    (baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/pages/${encodeURIComponent(
          page?.slug || String(slug)
        )}`
      : null);

  function shareAsLink() {
    setShareOpen(false);
    if (!pageUrl) return;
    router.push(`/compose?type=Link&href=${encodeURIComponent(pageUrl)}`);
  }

  async function shareToApps() {
    setShareOpen(false);
    if (!pageUrl) return;
    try {
      await Share.share({
        message: pageUrl,
        url: pageUrl,
        title: page?.title || page?.name,
      });
    } catch {
      // user dismissed or share unavailable — no-op
    }
  }

  const insets = useSafeAreaInsets();

  const typography = {
    fonts: {
      regular: resolved.regularFamily,
      bold: resolved.boldFamily,
      italic: resolved.italicFamily,
    },
    fontSize: resolved.fontSize,
    lineHeight: resolved.lineHeight,
  };

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title={page?.title || page?.name}
        right={
          page ? (
            <Pressable
              onPress={() => setShareOpen(true)}
              hitSlop={8}
              android_ripple={{ color: "rgba(255,255,255,0.18)", borderless: true }}
              className="w-9 h-9 items-center justify-center"
              accessibilityLabel="Share page"
            >
              <Share2 size={18} color="#FFFFFF" strokeWidth={1.9} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className="py-20 items-center px-6">
            <Text className="font-ui text-base text-error text-center mb-4">
              {error}
            </Text>
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </View>
        ) : page ? (
          <>
            {/* Header */}
            <View className="px-5 pt-5">
              <Eyebrow>Page</Eyebrow>
              <Text className="font-ui text-3xl text-base-content leading-tight mt-2 mb-3">
                {page.title || page.name}
              </Text>

              {imageSrc ? (
                <Image
                  source={{ uri: imageSrc }}
                  className="w-full h-64 mb-4   bg-base-200"
                  resizeMode="cover"
                />
              ) : null}

              {page.summary ? (
                <Text className="font-ui italic text-lg text-base-content/75 leading-snug mb-4">
                  {page.summary}
                </Text>
              ) : null}

              {/* Author + updated/created */}
              {author ? (
                <View className="flex-row items-center mb-3   pb-4">
                  <Avatar
                    actor={author}
                    size={36}
                    baseUrl={client?.http?.baseUrl}
                  />
                  <View className="ml-3 flex-1">
                    <Text
                      className="font-ui text-sm font-bold text-base-content"
                      numberOfLines={1}
                    >
                      {author.name || author.id}
                    </Text>
                    <Text
                      className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/55"
                      numberOfLines={1}
                    >
                      {updatedAt
                        ? `Updated · ${timeAgo(updatedAt)}`
                        : timeAgo(page.createdAt || page.publishedAt)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {page.tags?.length > 0 ? (
                <View className="flex-row items-center flex-wrap mb-3">
                  <Tag
                    size={11}
                    color="rgba(26,26,32,0.45)"
                    strokeWidth={1.75}
                  />
                  {page.tags.map((tag) => (
                    <Text
                      key={tag}
                      className="font-ui text-[11px] uppercase tracking-[0.16em] text-base-content/55 ml-2"
                    >
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Body — typography-aware padding for column width */}
            <View
              style={{ paddingHorizontal: resolved.paddingHorizontal, paddingTop: 8 }}
            >
              {page.body ? (
                <HtmlContent
                  html={page.body}
                  fonts={typography.fonts}
                  fontSize={typography.fontSize}
                  lineHeight={typography.lineHeight}
                  selectable
                />
              ) : (
                <Text className="font-ui text-base text-base-content/50">
                  No content.
                </Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Share sheet — as a Kowloon Link post, or via the OS share sheet. */}
      <Modal
        visible={shareOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setShareOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShareOpen(false)}
        >
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={["bottom"]} className="bg-base-100">
              <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50">
                  Share Page
                </Text>
                <Pressable onPress={() => setShareOpen(false)} hitSlop={8}>
                  <X size={18} color="rgba(26,26,32,0.6)" strokeWidth={2} />
                </Pressable>
              </View>
              <Pressable
                onPress={shareAsLink}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="flex-row items-center px-5 py-4"
              >
                <Link2 size={18} color="rgba(26,26,32,0.85)" strokeWidth={1.75} />
                <Text className="font-ui text-base text-base-content ml-3">
                  Share as a Post
                </Text>
              </Pressable>
              <Pressable
                onPress={shareToApps}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="flex-row items-center px-5 py-4"
              >
                <Share2 size={18} color="rgba(26,26,32,0.85)" strokeWidth={1.75} />
                <Text className="font-ui text-base text-base-content ml-3">
                  Share to Other Apps
                </Text>
              </Pressable>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
