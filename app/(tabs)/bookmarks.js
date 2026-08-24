// Bookmarks — the signed-in user's own bookmark tree, with buttons to save a
// new bookmark or create a folder. Promoted from a sub-tab buried inside the
// user's own profile page (app/user/[id]/index.js) to a first-class bottom
// tab; the tree/composer/action-sheet wiring is identical to that page's.

import { useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, FolderPlus } from "lucide-react-native";

import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { TabletColumns } from "../../src/components/layout/TabletColumns.jsx";
import { BookmarkComposer } from "../../src/components/bookmarks/BookmarkComposer.jsx";
import { BookmarkTree } from "../../src/components/bookmarks/BookmarkTree.jsx";
import {
  BookmarkActionSheet,
  FolderCreateModal,
} from "../../src/components/bookmarks/BookmarkActionSheet.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { selectActiveAccount } from "../../src/state/accountsSlice.js";

export default function Bookmarks() {
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);

  const treeRef = useRef(null);
  const [menuTarget, setMenuTarget] = useState(null); // { node, onComplete }
  const [composingBookmark, setComposingBookmark] = useState(false);
  const [composingFolder, setComposingFolder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = account?.id;

  async function refresh() {
    setRefreshing(true);
    await treeRef.current?.refreshRoot?.();
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader title="Bookmarks" />

      <TabletColumns>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
        >
          <View className="flex-row items-center px-4 pt-4 pb-1 gap-2">
            <Pressable
              onPress={() => setComposingBookmark(true)}
              className="flex-row items-center justify-center gap-2 bg-primary py-3.5 flex-1"
              android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.25} />
              <Text className="font-ui uppercase tracking-[0.18em] text-sm text-primary-content">
                Bookmark
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setComposingFolder(true)}
              className="flex-row items-center justify-center gap-2 bg-base-200 py-3.5 px-4"
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <FolderPlus size={16} color="#5C5C5C" strokeWidth={2.25} />
              <Text className="font-ui uppercase tracking-[0.18em] text-sm text-base-content/70">
                Folder
              </Text>
            </Pressable>
          </View>

          <BookmarkTree
            ref={treeRef}
            userId={userId}
            client={client}
            isOwner
            account={account}
            onMenu={setMenuTarget}
          />
        </ScrollView>
      </TabletColumns>

      <BookmarkActionSheet
        target={menuTarget}
        client={client}
        account={account}
        onClose={() => setMenuTarget(null)}
        onMutated={() => {
          menuTarget?.onComplete?.();
          treeRef.current?.refreshRoot?.();
          setMenuTarget(null);
        }}
      />

      <BookmarkComposer
        visible={composingBookmark}
        onClose={() => setComposingBookmark(false)}
        initialValues={{}}
        client={client}
        currentUser={account}
        onSaved={() => {
          treeRef.current?.refreshRoot?.();
          setComposingBookmark(false);
        }}
      />
      <FolderCreateModal
        visible={composingFolder}
        client={client}
        onClose={() => setComposingFolder(false)}
        onCreated={() => {
          treeRef.current?.refreshRoot?.();
          setComposingFolder(false);
        }}
      />
    </SafeAreaView>
  );
}
