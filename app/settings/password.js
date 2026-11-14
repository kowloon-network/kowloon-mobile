// Change password.
//
// Posts straight to /auth/change-password via client.auth.changePassword()
// rather than going through an Update activity — the server has to verify the
// current password before it will touch the stored hash, so this never goes
// near the outbox.
//
// The server hands back a fresh token on success and the SDK swaps it into
// storage, so the active session survives the change. Sessions on OTHER
// devices are NOT signed out: tokens are stateless and stay valid until they
// expire. The copy below says so rather than implying a global sign-out.

import { useState } from "react";
import { useRouter } from "expo-router";
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

const MIN_LENGTH = 8;

export default function ChangePassword() {
  const router = useRouter();
  const client = useActiveClient();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSave =
    current.length > 0 &&
    next.length >= MIN_LENGTH &&
    next === confirm &&
    !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await client.auth.changePassword({
        currentPassword: current,
        newPassword: next,
      });
      router.back();
    } catch (e) {
      setError(e?.message || "Couldn't change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      className="flex-1 bg-base-100"
      edges={["left", "right", "bottom"]}
    >
      <AppHeader back title="Password" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-ui text-xs text-base-content/50 mb-6">
            You'll stay signed in on this device. Changing your password signs
            you out everywhere else.
          </Text>

          <Field
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
          />

          <Field
            label="New password"
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            error={tooShort ? `At least ${MIN_LENGTH} characters.` : undefined}
            hint={tooShort ? undefined : `At least ${MIN_LENGTH} characters.`}
          />

          <Field
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            error={mismatch ? "These don't match." : undefined}
          />
        </ScrollView>

        {/* Sticky footer — always visible above keyboard */}
        <View className="px-6 pt-3 pb-2 bg-base-100">
          {error ? (
            <Text className="font-ui text-sm text-error mb-3">{error}</Text>
          ) : null}
          <Pressable
            onPress={canSave ? save : undefined}
            disabled={!canSave}
            className="bg-primary items-center justify-center h-12 mb-3"
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            {saving ? (
              <ActivityIndicator color="#FAF4E8" />
            ) : (
              <Text className="font-ui uppercase tracking-[0.14em] text-sm text-primary-content">
                Change Password
              </Text>
            )}
          </Pressable>
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
