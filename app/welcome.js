// First-launch entry — no accounts yet. Three paths in:
//   - Log in to an existing account
//   - Register a new account on a server
//   - Scan an invite QR (deep-link bypass)

import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../src/components/ui/Button.jsx";
import { Heading, Eyebrow } from "../src/components/ui/Heading.jsx";
import { TabletColumns } from "../src/components/layout/TabletColumns.jsx";

export default function Welcome() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <TabletColumns sidebar={false}>
      <View className="flex-1 px-6 justify-between">
        <View className="pt-12">
          <Eyebrow>The Kowloon Network</Eyebrow>
          <Heading className="text-5xl mt-3 leading-[1.05]">
            Welcome.
          </Heading>
          <Text className="font-ui text-base text-base-content/70 mt-4 leading-6">
            Federated, circle-based social media. To get started, sign in to a
            server you already have an account on, or join a new one.
          </Text>
        </View>

        <View className="pb-8">
          <Button
            label="Log in"
            onPress={() => router.push("/login")}
            className="mb-3"
          />
          <Button
            label="Register"
            variant="secondary"
            onPress={() => router.push("/register")}
            className="mb-3"
          />
          <Button
            label="Scan invite code"
            variant="ghost"
            onPress={() => router.push("/scan")}
          />
        </View>
      </View>
      </TabletColumns>
    </SafeAreaView>
  );
}
