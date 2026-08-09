// Log in to an existing Kowloon account.
//
// Flow:
//   1. User enters "@user@domain" + password (and optional server URL override
//      for local dev where HTTPS isn't available).
//   2. Parse the ID → derive baseUrl from the domain (or the override).
//   3. Hit POST /auth/login via an ephemeral KowloonClient. On success,
//      register the account in Redux + persist, then redirect to the feed.

import { useState } from "react";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../src/components/ui/Button.jsx";
import { Field } from "../src/components/ui/Field.jsx";
import { Heading, Eyebrow } from "../src/components/ui/Heading.jsx";
import { parseKowloonId, inferBaseUrl, domainFromUrl } from "../src/lib/identity.js";
import { ensureClient, forgetClient } from "../src/lib/client.js";
import { addAccountAndPersist } from "../src/state/accountsSlice.js";
import { purgeAccountStorage } from "../src/lib/storage.js";
import { TabletColumns } from "../src/components/layout/TabletColumns.jsx";

export default function Login() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [kowloonId, setKowloonId] = useState("");
  const [password, setPassword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serverOverride, setServerOverride] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    const parsed = parseKowloonId(kowloonId);
    if (!parsed) {
      setError("Enter your Kowloon ID, like @you@example.com");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    const override = serverOverride.trim();
    const baseUrl = override
      ? /^https?:\/\//i.test(override)
        ? override.replace(/\/$/, "")
        : inferBaseUrl(domainFromUrl(override) || override)
      : inferBaseUrl(parsed.domain);

    const provisionalAccount = {
      id: parsed.id,
      username: parsed.username,
      server: parsed.domain,
      baseUrl,
    };

    setSubmitting(true);
    try {
      const client = ensureClient(provisionalAccount);
      const result = await client.auth.login({
        id: parsed.id,
        password,
      });

      if (!result?.token || !result?.user) {
        throw new Error("Server didn't return a session token.");
      }

      const account = {
        ...provisionalAccount,
        profile: result.user.profile || null,
        addedAt: new Date().toISOString(),
      };

      await dispatch(addAccountAndPersist(account));
      router.replace("/feed");
    } catch (e) {
      forgetClient(parsed.id);
      await purgeAccountStorage(parsed.id).catch(() => {});
      // Only call it a credentials problem on an actual 401. A server blip (5xx,
      // e.g. mid-deploy) or a network failure must NOT read as "wrong password" —
      // that sends people chasing a password that's actually fine.
      const status = e?.statusCode;
      let msg;
      if (status === 401) {
        msg = "That username or password is incorrect.";
      } else if (status === 403) {
        msg = e?.message || "This account can't sign in right now.";
      } else if (e?.name === "NetworkError") {
        msg = "Couldn't reach the server. Check your connection and try again.";
      } else if (typeof status === "number" && status >= 500) {
        msg = "The server had a problem (it may be briefly restarting). Try again in a moment.";
      } else {
        msg = e?.message || "Login failed. Please try again.";
      }
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <TabletColumns sidebar={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-10 pb-8">
            <Eyebrow>Sign in</Eyebrow>
            <Heading className="text-4xl mt-2 mb-6 leading-tight">
              Welcome back.
            </Heading>

            <Field
              label="Kowloon ID"
              value={kowloonId}
              onChangeText={setKowloonId}
              placeholder="@you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />

            <Pressable
              onPress={() => setShowAdvanced((v) => !v)}
              className="mb-4"
            >
              <Text className="font-ui uppercase tracking-[0.2em] text-[11px] text-base-content/60">
                {showAdvanced ? "Hide" : "Use a different server URL"}
              </Text>
            </Pressable>

            {showAdvanced ? (
              <Field
                label="Server URL"
                value={serverOverride}
                onChangeText={setServerOverride}
                placeholder="http://100.83.23.39:3000"
                hint="For local development or non-default ports."
              />
            ) : null}

            {error ? (
              <Text className="font-ui text-sm text-error mt-2 mb-2">
                {error}
              </Text>
            ) : null}

            <View className="mt-4">
              <Button
                label={submitting ? "Signing in" : "Sign in"}
                onPress={handleSubmit}
                loading={submitting}
              />
              <Button
                label="Back"
                variant="ghost"
                onPress={() => router.back()}
                className="mt-3"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </TabletColumns>
    </SafeAreaView>
  );
}
