// Change email.
//
// Posts to /auth/change-email via client.auth.changeEmail(). The server asks
// for the current password because the email address is how an account is
// recovered: whoever controls it can reset the password. The new address
// starts unverified and is sent a confirmation link.

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmail() {
  const router = useRouter();
  const client = useActiveClient();
  const me = client?.auth?.getUser?.() || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const canSave = EMAIL_RE.test(email.trim()) && password.length > 0 && !saving;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await client.auth.changeEmail({ password, email: email.trim() });
      setDone(res);
      setPassword("");
    } catch (e) {
      setError(e?.message || "Couldn't change your email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right", "bottom"]}>
      <AppHeader back title="Email" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {done ? (
            <Text className="font-ui text-base text-base-content/80 leading-6">
              {done.verificationSent
                ? `Your email is now ${done.email}. We sent a link there to confirm it.`
                : `Your email is now ${done.email}, but the confirmation email couldn't be sent. Ask your server's admin to check its email settings.`}
            </Text>
          ) : (
            <>
              <Text className="font-ui text-xs text-base-content/50 mb-6">
                Only you and your server's admins can see this. Password resets are sent here.
              </Text>
              {me?.email ? (
                <View className="mb-5">
                  <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 mb-1">
                    Current email
                  </Text>
                  <Text className="font-ui text-base text-base-content">{me.email}</Text>
                  {me.emailVerified === false ? (
                    <Text className="font-ui text-xs text-base-content/50 mt-1">
                      Not verified yet. Check your inbox for the link.
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <Field
                label="New email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Field
                label="Current password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </>
          )}
        </ScrollView>

        <View className="px-6 pt-3 pb-2 bg-base-100">
          {error ? <Text className="font-ui text-sm text-error mb-3">{error}</Text> : null}
          {done ? (
            <Button label="Done" onPress={() => router.back()} />
          ) : (
            <>
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
                    Change Email
                  </Text>
                )}
              </Pressable>
              <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
