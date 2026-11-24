// Holding screen shown after registering on a server that requires email
// verification. The server has accepted the account but won't issue a session
// token until the user clicks the link in their inbox.

import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../src/components/ui/Button.jsx";
import { Heading, Eyebrow } from "../src/components/ui/Heading.jsx";
import { inferBaseUrl } from "../src/lib/identity.js";
import { makeEphemeralClient } from "../src/lib/client.js";

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = typeof params.email === "string" ? params.email : "";
  const server = typeof params.server === "string" ? params.server : "";
  const [resend, setResend] = useState("idle"); // idle | sending | sent | failed

  // Didn't get it? Ask the server for a fresh link. Only possible when we
  // know both the address and the server (register.js passes them).
  async function resendLink() {
    setResend("sending");
    try {
      await makeEphemeralClient(inferBaseUrl(server)).auth.resendVerification({ email });
      setResend("sent");
    } catch {
      setResend("failed");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <View className="flex-1 px-6 pt-10 pb-8 justify-between">
        <View>
          <Eyebrow>Check your email</Eyebrow>
          <Heading className="text-4xl mt-2 mb-4 leading-tight">
            Almost there.
          </Heading>
          <Text className="font-ui text-base text-base-content/70 leading-6 mb-3">
            {email
              ? `We sent a verification link to ${email}. Open it on this device to finish setting up your account on ${server}.`
              : `Open the verification link ${server ? `from ${server} ` : ""}to finish setting up your account.`}
          </Text>
          <Text className="font-ui text-sm text-base-content/50 leading-5">
            Once verified, come back to this app and sign in with your new
            Kowloon ID.
          </Text>
          {email && server ? (
            <View className="mt-6">
              {resend === "sent" ? (
                <Text className="font-ui text-sm text-base-content/70">
                  Sent a new link to {email}. Check your spam folder too.
                </Text>
              ) : (
                <Pressable
                  onPress={resendLink}
                  disabled={resend === "sending"}
                  hitSlop={8}
                  className="self-start"
                  accessibilityRole="button"
                >
                  <Text className="font-ui text-sm text-primary">
                    {resend === "sending" ? "Sending..." : "Didn't get it? Send the link again"}
                  </Text>
                </Pressable>
              )}
              {resend === "failed" ? (
                <Text className="font-ui text-sm text-error mt-2">
                  Couldn't reach {server}. Check your connection and try again.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <View>
          <Button label="Sign in" onPress={() => router.replace("/login")} />
          <Button
            label="Back to start"
            variant="ghost"
            onPress={() => router.replace("/welcome")}
            className="mt-3"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
