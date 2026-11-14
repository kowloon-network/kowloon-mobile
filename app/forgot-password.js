// Forgot your password? Asks your server to email a reset link. The link
// opens the server's web reset page (the same one the website uses), so this
// screen only has to start the process.
//
// The server is worked out from your Kowloon ID, prefilled from the login
// screen when you'd already typed it. The server answers the same whether or
// not the address is registered, so the confirmation says "if".

import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../src/components/ui/Button.jsx";
import { Field } from "../src/components/ui/Field.jsx";
import { Heading, Eyebrow } from "../src/components/ui/Heading.jsx";
import { parseKowloonId, inferBaseUrl } from "../src/lib/identity.js";
import { makeEphemeralClient } from "../src/lib/client.js";
import { TabletColumns } from "../src/components/layout/TabletColumns.jsx";

export default function ForgotPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [kowloonId, setKowloonId] = useState(typeof params.id === "string" ? params.id : "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    const parsed = parseKowloonId(kowloonId);
    if (!parsed) {
      setError("Enter your Kowloon ID, like @you@example.com, so we know which server to ask.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address on your account.");
      return;
    }
    setSending(true);
    try {
      const client = makeEphemeralClient(inferBaseUrl(parsed.domain));
      await client.auth.requestPasswordReset({ email: email.trim() });
      setSent(true);
    } catch (e) {
      setError(
        e?.name === "NetworkError"
          ? `Couldn't reach ${parsed.domain}. Check the server name and your connection.`
          : e?.message || "Something went wrong. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <TabletColumns sidebar={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View className="flex-1 px-6 pt-10 pb-8">
              <Eyebrow>Reset password</Eyebrow>
              <Heading className="text-4xl mt-2 mb-6 leading-tight">
                {sent ? "Check your email." : "Forgot your password?"}
              </Heading>

              {sent ? (
                <>
                  <Text className="font-ui text-base text-base-content/75 leading-6 mb-6">
                    If {email.trim()} belongs to an account on {parseKowloonId(kowloonId)?.domain}, a
                    reset link is on its way. It works for one hour. Open it, choose a new password,
                    then come back here to sign in.
                  </Text>
                  <Button label="Back to sign in" onPress={() => router.back()} />
                </>
              ) : (
                <>
                  <Text className="font-ui text-base text-base-content/75 leading-6 mb-6">
                    We'll email you a link to choose a new one.
                  </Text>
                  <Field
                    label="Kowloon ID"
                    value={kowloonId}
                    onChangeText={setKowloonId}
                    placeholder="@you@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <Field
                    label="Email on your account"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  {error ? (
                    <Text className="font-ui text-sm text-error mt-2 mb-2">{error}</Text>
                  ) : null}
                  <View className="mt-4">
                    <Button
                      label={sending ? "Sending" : "Send reset link"}
                      onPress={handleSubmit}
                      loading={sending}
                    />
                    <Button label="Back" variant="ghost" onPress={() => router.back()} className="mt-3" />
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TabletColumns>
    </SafeAreaView>
  );
}
