// Settings index.
// Accounts section: switch between accounts, add another, sign out per account.
// This Account section: profile and typography for whoever is active.

import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "../../src/components/posts/Avatar.jsx";
import { Button } from "../../src/components/ui/Button.jsx";
import { Eyebrow, Heading } from "../../src/components/ui/Heading.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import {
  selectAccounts,
  selectActiveId,
  signOutAccount,
  setActiveAndPersist,
} from "../../src/state/accountsSlice.js";

function SectionLabel({ children }) {
  return (
    <Text className="font-ui text-[10px] font-semibold tracking-[0.12em] uppercase text-base-content/40 mb-2">
      {children}
    </Text>
  );
}

function NavRow({ label, hint, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="  bg-base-100 px-4 py-4 mb-3 flex-row items-center justify-between"
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
    >
      <View className="flex-1">
        <Text className="font-ui text-lg text-base-content">{label}</Text>
        {hint ? (
          <Text className="font-ui text-xs text-base-content/50 mt-0.5">
            {hint}
          </Text>
        ) : null}
      </View>
      <Text className="font-ui text-2xl text-base-content/40">{"›"}</Text>
    </Pressable>
  );
}

function AccountRow({ account, isActive, onSwitch, onSignOut }) {
  const actor = {
    name: account.profile?.name || account.username,
    icon: account.profile?.icon,
  };

  return (
    <Pressable
      onPress={isActive ? undefined : onSwitch}
      className={`flex-row items-center px-4 py-3 mb-2  ${
        isActive
          ? " bg-base-content"
          : " bg-base-100"
      }`}
      android_ripple={isActive ? undefined : { color: "rgba(0,0,0,0.05)" }}
    >
      <Avatar actor={actor} size={36} baseUrl={account.baseUrl} />

      <View className="flex-1 ml-3">
        <Text
          className={`font-ui text-sm font-semibold ${
            isActive ? "text-base-100" : "text-base-content"
          }`}
        >
          {account.profile?.name || account.username}
        </Text>
        <Text
          className={`font-ui text-xs ${
            isActive ? "text-base-100/70" : "text-base-content/50"
          }`}
          numberOfLines={1}
        >
          {account.id}
        </Text>
      </View>

      {isActive ? (
        <Text className="font-ui text-xs text-base-100/60 mr-3 uppercase tracking-widest">
          Active
        </Text>
      ) : null}

      <Pressable
        onPress={onSignOut}
        hitSlop={10}
        className={`w-7 h-7 items-center justify-center  ${
          isActive ? "" : ""
        }`}
      >
        <Text
          className={`font-ui text-sm leading-none ${
            isActive ? "text-base-100/60" : "text-base-content/40"
          }`}
        >
          ×
        </Text>
      </Pressable>
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const dispatch = useDispatch();
  const activeId = useSelector(selectActiveId);
  const accounts = useSelector(selectAccounts);

  async function handleSignOut(accountId) {
    const wasActive = accountId === activeId;
    const willHaveAccounts = accounts.length > 1;
    await dispatch(signOutAccount(accountId));
    if (wasActive) {
      router.replace(willHaveAccounts ? "/feed" : "/welcome");
    }
  }

  async function handleSwitch(accountId) {
    await dispatch(setActiveAndPersist(accountId));
    router.replace("/feed");
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right", "bottom"]}>
      <AppHeader back title="Settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-6">
          {/* ── Accounts ── */}
          <SectionLabel>Accounts</SectionLabel>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isActive={account.id === activeId}
              onSwitch={() => handleSwitch(account.id)}
              onSignOut={() => handleSignOut(account.id)}
            />
          ))}
          <Pressable
            onPress={() => router.push("/login")}
            className="  bg-base-100 px-4 py-3 mb-8 flex-row items-center gap-3"
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          >
            <View className="w-9 h-9   items-center justify-center">
              <Text className="font-ui text-xl text-base-content/40 leading-none">
                +
              </Text>
            </View>
            <Text className="font-ui text-sm text-base-content/60">
              Add another account
            </Text>
          </Pressable>

          {/* ── This Account ── */}
          <SectionLabel>This Account</SectionLabel>
          <NavRow
            label="Profile"
            hint="Avatar, display name, bio, links"
            onPress={() => router.push("/settings/profile")}
          />
          <NavRow
            label="Preferences"
            hint="Composing, feed, notifications, time zone"
            onPress={() => router.push("/settings/preferences")}
          />
          <NavRow
            label="Typography"
            hint="Reading font, size, spacing, margins"
            onPress={() => router.push("/settings/typography")}
          />
        </View>

        <View className="px-6 mt-4">
          <Button label="Done" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
