// User menu — the dropdown opened by tapping the masthead avatar.
//
// A transparent Modal: tap the backdrop to dismiss, tap a row to navigate.
// Header doubles as a shortcut to the user's own profile. Editorial styling:
// hard edges, 2px frame, cream panel.

import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Plus } from "lucide-react-native";

import { Avatar } from "./posts/Avatar.jsx";
import { useUnreadCount } from "../lib/UnreadCountContext.js";
import { useIsAdmin } from "../lib/useIsAdmin.js";
import {
  selectAccounts,
  selectActiveAccount,
  setActiveAndPersist,
  signOutAccount,
} from "../state/accountsSlice.js";

function MenuRow({ label, onPress, destructive = false, badge }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      className="px-4 py-3.5   flex-row items-center"
    >
      <Text
        className={`font-ui text-sm uppercase tracking-[0.14em] flex-1 ${
          destructive ? "text-error" : "text-base-content"
        }`}
      >
        {label}
      </Text>
      {typeof badge === "number" && badge > 0 ? (
        <View className="bg-primary min-w-[20px] h-5 items-center justify-center px-1.5 ml-2">
          <Text className="font-ui text-[10px] font-bold text-primary-content">
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function UserMenu({ visible, onClose }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const account = useSelector(selectActiveAccount);
  const accounts = useSelector(selectAccounts);
  const { count: unreadCount } = useUnreadCount();
  const isAdmin = useIsAdmin();

  if (!account) return null;

  const me = {
    name: account.profile?.name || account.username,
    icon: account.profile?.icon || null,
    id: account.id,
  };

  // Close first, then navigate, so the modal isn't left mounted over the
  // destination screen.
  function go(path) {
    onClose();
    router.push(path);
  }

  async function handleSignOut() {
    onClose();
    await dispatch(signOutAccount(account.id));
    router.replace(accounts.length <= 1 ? "/welcome" : "/feed");
  }

  // Other signed-in accounts, tap to switch to.
  const others = accounts.filter((a) => a.id !== account.id);

  async function switchTo(id) {
    onClose();
    await dispatch(setActiveAndPersist(id));
    // Reset to the feed so no screen keeps the previous account's data.
    router.replace("/feed");
  }

  function addAccount() {
    onClose();
    // Login adds the account (addAccountAndPersist) without signing out the
    // current one, then returns to the feed as the new active account.
    router.push("/login");
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <SafeAreaView edges={["top"]}>
          {/* Panel — anchored top-right under the masthead. The inner
              Pressable swallows taps so they don't reach the backdrop. */}
          <Pressable
            onPress={() => {}}
            className="self-end mr-3 mt-2 w-64   bg-base-100"
          >
            {/* Header → own profile */}
            <Pressable
              onPress={() => go(`/user/${encodeURIComponent(account.id)}`)}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="flex-row items-center p-4"
            >
              <Avatar actor={me} size={44} baseUrl={account.baseUrl} />
              <View className="flex-1 ml-3">
                <Text
                  className="font-ui text-base text-base-content"
                  numberOfLines={1}
                >
                  {me.name}
                </Text>
                <Text
                  className="font-ui text-xs text-base-content/50"
                  numberOfLines={1}
                >
                  {account.id}
                </Text>
              </View>
            </Pressable>

            {/* Account switcher — other signed-in accounts + add another. */}
            {others.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => switchTo(a.id)}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="flex-row items-center px-4 py-3 border-t border-base-200"
              >
                <Avatar
                  actor={{ name: a.profile?.name || a.username, icon: a.profile?.icon }}
                  size={32}
                  baseUrl={a.baseUrl}
                />
                <View className="flex-1 ml-3 min-w-0">
                  <Text className="font-ui text-sm text-base-content" numberOfLines={1}>
                    {a.profile?.name || a.username}
                  </Text>
                  <Text className="font-ui text-xs text-base-content/50" numberOfLines={1}>
                    {a.id}
                  </Text>
                </View>
                <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-primary ml-2">
                  Switch
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={addAccount}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              className="flex-row items-center px-4 py-3 border-t border-base-200"
            >
              <View className="w-8 h-8 items-center justify-center border border-base-300">
                <Plus size={16} color="rgba(26,26,32,0.6)" strokeWidth={2} />
              </View>
              <Text className="font-ui text-sm text-base-content ml-3">Add account</Text>
            </Pressable>

            <View className="h-2 bg-base-200" />

            <MenuRow
              label="Profile"
              onPress={() => go(`/user/${encodeURIComponent(account.id)}`)}
            />
            <MenuRow
              label="Notifications"
              onPress={() => go("/notifications")}
              badge={unreadCount}
            />
            <MenuRow label="Discover" onPress={() => go("/discover")} />
            <MenuRow label="Search" onPress={() => go("/search")} />
            <MenuRow label="Circles" onPress={() => go("/circles")} />
            <MenuRow label="Groups" onPress={() => go("/groups")} />
            {isAdmin ? (
              <MenuRow label="Server Admin" onPress={() => go("/admin")} />
            ) : null}
            <MenuRow label="Settings" onPress={() => go("/settings")} />
            <MenuRow
              label="Log out"
              destructive
              onPress={handleSignOut}
            />
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
