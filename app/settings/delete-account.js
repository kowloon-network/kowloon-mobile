// Delete account (Apple App Store Guideline 5.1.1(v) self-service deletion).
//
// Mirrors password.js's screen shape -- password re-entry, disabled/saving/
// error sticky footer -- but destructive-styled, and on success clears local
// session state the same way settings/index.js's handleSignOut does (the
// server has already deleted the account; there's no session left to keep).
// A native Alert.alert double-confirm gates even opening this screen -- see
// its entry point in settings/index.js.

import { useState } from "react";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../src/components/ui/Button.jsx";
import { Field } from "../../src/components/ui/Field.jsx";
import { AppHeader } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import {
  selectAccounts,
  selectActiveId,
  signOutAccount,
} from "../../src/state/accountsSlice.js";

export default function DeleteAccount() {
  const router = useRouter();
  const dispatch = useDispatch();
  const client = useActiveClient();
  const activeId = useSelector(selectActiveId);
  const accounts = useSelector(selectAccounts);

  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canDelete = password.length > 0 && !saving;

  async function deleteAccount() {
    setSaving(true);
    setError(null);
    try {
      await client.auth.deleteAccount({ password });
      // The account is gone server-side -- clear local session the same way
      // a manual sign-out does, then land wherever sign-out would.
      const willHaveAccounts = accounts.length > 1;
      await dispatch(signOutAccount(activeId));
      router.replace(willHaveAccounts ? "/feed" : "/welcome");
    } catch (e) {
      setError(e?.message || "Couldn't delete your account.");
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      className="flex-1 bg-base-100"
      edges={["left", "right", "bottom"]}
    >
      <AppHeader back title="Delete Account" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-ui text-sm text-error mb-2">
            This permanently deletes your account.
          </Text>
          <Text className="font-ui text-xs text-base-content/50 mb-6">
            Your posts, replies, reactions, bookmarks, and uploaded files are
            removed. Any Group you own is reassigned to a server admin rather
            than left ownerless. This cannot be undone.
          </Text>

          <Field
            label="Confirm your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </ScrollView>

        {/* Sticky footer — always visible above keyboard */}
        <View className="px-6 pt-3 pb-2 bg-base-100">
          {error ? (
            <Text className="font-ui text-sm text-error mb-3">{error}</Text>
          ) : null}
          <Pressable
            onPress={canDelete ? deleteAccount : undefined}
            disabled={!canDelete}
            className="bg-error items-center justify-center h-12 mb-3"
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            style={{ opacity: canDelete ? 1 : 0.5 }}
          >
            {saving ? (
              <ActivityIndicator color="#FAF4E8" />
            ) : (
              <Text className="font-ui uppercase tracking-[0.14em] text-sm text-error-content">
                Delete My Account
              </Text>
            )}
          </Pressable>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
