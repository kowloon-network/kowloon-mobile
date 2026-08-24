// BookmarkTree — lazy-loaded folder/bookmark tree for a single user.
//
// Mount fetches root-level items via getUserBookmarks({ parentFolder: 'root' }).
// Tapping a folder expands it and lazy-loads its direct children. The owner
// gets a context menu (⋯) on each row for edit / move / delete.
//
// Visibility is fully enforced server-side: bookmarks in a private folder
// won't be returned to non-owners regardless of the bookmark's own `to`.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { TreeNode } from "./TreeNode.jsx";

export const BookmarkTree = forwardRef(function BookmarkTree(
  { userId, client, isOwner, account, onMenu, emptyTitle, emptyBody },
  ref
) {
  const [rootNodes, setRootNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // versionMap keys a node ID to a numeric version; bumping it forces the
  // node's TreeNode to re-fetch its children. Used after a context-menu
  // mutation so the affected folder reflects the change.
  const [versionMap, setVersionMap] = useState({});

  const loadRoot = useCallback(async () => {
    if (!client || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.feeds.getUserBookmarks({
        userId,
        parentFolder: "root",
      });
      setRootNodes(res?.orderedItems || res?.items || []);
    } catch (e) {
      setError(e?.message || "Couldn't load bookmarks.");
    } finally {
      setLoading(false);
    }
  }, [client, userId]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  function bumpVersion(folderId) {
    setVersionMap((prev) => ({ ...prev, [folderId]: (prev[folderId] || 0) + 1 }));
  }

  useImperativeHandle(ref, () => ({
    refreshRoot: loadRoot,
    refreshFolder: bumpVersion,
  }));

  if (loading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    return (
      <View className="py-12 px-6 items-center">
        <Text className="font-ui text-sm text-error text-center">{error}</Text>
      </View>
    );
  }
  if (!rootNodes.length) {
    // Unlike Circles, bookmarks/folders can be @public or server-visible, so
    // an empty result for a non-owner isn't necessarily "private" -- it may
    // just mean nothing here is currently public/server-visible to you (or
    // there's nothing at all). Keep the copy accurate either way.
    return (
      <View className="px-6 py-16 items-center">
        <Text className="font-ui text-lg text-base-content/70 text-center mb-2">
          {emptyTitle || (isOwner ? "No bookmarks yet." : "Nothing here yet.")}
        </Text>
        <Text className="font-ui text-sm text-base-content/55 text-center leading-6">
          {emptyBody || (isOwner
            ? "Save a link from a post and it lands here."
            : "Nothing they've saved is public or visible to you yet.")}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {rootNodes.map((n) => (
        <TreeNode
          key={n.id}
          node={n}
          depth={0}
          userId={userId}
          client={client}
          isOwner={isOwner}
          account={account}
          onMenu={onMenu}
          version={versionMap[n.id] || 0}
        />
      ))}
    </View>
  );
});
