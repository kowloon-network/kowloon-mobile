// TreeNode — one row in BookmarkTree. Folders expand to lazy-load children;
// Bookmarks open their href in the system browser. Owner gets a ⋯ menu.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { ChevronRight, Folder, MoreHorizontal } from "lucide-react-native";

import { VisibilityChip } from "./VisibilityChip.jsx";
import { resolveImageUrl } from "../../lib/resolveImageUrl.js";
import { useInk } from "../../lib/useInk.js";

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return String(url)
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
  }
}

const INDENT_PX = 16;

export function TreeNode({
  node,
  depth,
  userId,
  client,
  isOwner,
  account,
  onMenu,
  version = 0,
}) {
  const ink = useInk();
  const isFolder = node?.type === "Folder";
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [childVersions, setChildVersions] = useState({});

  const fetchChildren = useCallback(async () => {
    if (!client || !userId || !node?.id) return;
    setLoading(true);
    try {
      const res = await client.feeds.getUserBookmarks({
        userId,
        parentFolder: node.id,
      });
      setChildren(res?.orderedItems || res?.items || []);
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [client, userId, node?.id]);

  // Reload when our own version bumps (parent told us to). Skip the first
  // render so we don't double-fetch on initial mount.
  useEffect(() => {
    if (version === 0) return;
    setExpanded(true);
    fetchChildren();
  }, [version, fetchChildren]);

  function toggle() {
    if (!expanded && children === null) fetchChildren();
    setExpanded((e) => !e);
  }

  function bumpChild(childId) {
    setChildVersions((prev) => ({
      ...prev,
      [childId]: (prev[childId] || 0) + 1,
    }));
  }

  const indent = depth * INDENT_PX;

  if (isFolder) {
    return (
      <View>
        <Pressable
          onPress={toggle}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          className="flex-row items-center py-3   bg-base-100"
          style={{ paddingLeft: indent + 20, paddingRight: 16 }}
        >
          <ChevronRight
            size={14}
            color={ink(0.55)}
            style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}
          />
          <Folder
            size={16}
            color="#5588B1"
            strokeWidth={1.75}
            style={{ marginLeft: 8 }}
          />
          <Text
            className="font-ui text-base text-base-content ml-2 flex-1"
            numberOfLines={1}
          >
            {node.title || "Untitled folder"}
          </Text>
          <View className="ml-2">
            <VisibilityChip to={node.to} compact />
          </View>
          {isOwner ? (
            <Pressable
              onPress={() =>
                onMenu?.({ node, onComplete: () => fetchChildren() })
              }
              hitSlop={10}
              className="ml-2"
              android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
            >
              <MoreHorizontal
                size={18}
                color={ink(0.55)}
                strokeWidth={1.75}
              />
            </Pressable>
          ) : null}
        </Pressable>

        {expanded ? (
          loading ? (
            <View
              className="py-3"
              style={{ paddingLeft: indent + INDENT_PX + 20 }}
            >
              <ActivityIndicator size="small" />
            </View>
          ) : children && children.length === 0 ? (
            <Text
              className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/40 py-2"
              style={{ paddingLeft: indent + INDENT_PX + 20 }}
            >
              Empty folder
            </Text>
          ) : (
            (children || []).map((c) => (
              <TreeNode
                key={c.id}
                node={c}
                depth={depth + 1}
                userId={userId}
                client={client}
                isOwner={isOwner}
                account={account}
                onMenu={(args) =>
                  onMenu?.({
                    ...args,
                    onComplete: () => {
                      args.onComplete?.();
                      bumpChild(c.id);
                      // Bump our own children list too in case the menu
                      // removed/moved the item itself.
                      fetchChildren();
                    },
                  })
                }
                version={childVersions[c.id] || 0}
              />
            ))
          )
        ) : null}
      </View>
    );
  }

  // Bookmark
  const image = resolveImageUrl(node?.image, account?.baseUrl);
  const host = hostOf(node?.href);

  async function openExternal() {
    if (!node?.href) return;
    try {
      await Linking.openURL(node.href);
    } catch {
      // OS couldn't open; nothing to do
    }
  }

  return (
    <Pressable
      onPress={openExternal}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-start py-3   bg-base-100"
      style={{ paddingLeft: indent + 20, paddingRight: 16 }}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={{ width: 44, height: 44 }}
          className="  bg-base-200 mr-3"
          resizeMode="cover"
        />
      ) : null}
      <View className="flex-1 min-w-0">
        <Text
          className="font-ui text-base text-base-content leading-snug"
          numberOfLines={2}
        >
          {node?.title || node?.href}
        </Text>
        {node?.summary ? (
          <Text
            className="font-ui text-sm text-base-content/65 leading-snug mt-1"
            numberOfLines={3}
          >
            {node.summary}
          </Text>
        ) : null}
        {host ? (
          <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55 mt-1">
            {host}
          </Text>
        ) : null}
      </View>
      <View className="ml-2 mt-1">
        <VisibilityChip to={node?.to} compact />
      </View>
      {isOwner ? (
        <Pressable
          onPress={() => onMenu?.({ node })}
          hitSlop={10}
          className="ml-2 mt-1"
          android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        >
          <MoreHorizontal
            size={18}
            color={ink(0.55)}
            strokeWidth={1.75}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
