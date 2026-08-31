// Get Started — the post-registration landing.
//
// Shown once, right after a new account is created. Gives the new member a
// direct path into the server's Community feed, plus the same server-curated
// shelves as Discover so they can start saving circles / joining groups before
// they even reach the timeline. Routed here from register.js via replace(), so
// there's no back-stack to the signup form.

import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";

import { Button } from "../src/components/ui/Button.jsx";
import { Eyebrow, Heading } from "../src/components/ui/Heading.jsx";
import { DiscoveryShelf } from "../src/components/discover/DiscoveryShelf.jsx";
import { useActiveClient } from "../src/lib/useActiveClient.js";
import { selectActiveAccount } from "../src/state/accountsSlice.js";

export default function GetStarted() {
  const router = useRouter();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const baseUrl = client?.http?.baseUrl;

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!client) return;
      setLoading(true);
      client.feeds
        .getDiscovery()
        .then((res) => setSections(res?.sections ?? []))
        .catch(() => setSections([]))
        .finally(() => setLoading(false));
    }, [client])
  );

  const serverName = account?.serverName || account?.server || "Kowloon";
  const enterFeed = () => router.replace("/feed");

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View className="px-6 pt-10 pb-6  ">
          <Eyebrow>You're in</Eyebrow>
          <Heading className="text-4xl mt-2 leading-[1.05]">
            Welcome to {serverName}.
          </Heading>
          <Text className="font-ui text-base text-base-content/70 mt-4 leading-6">
            Jump straight into the community feed, or explore a few things the
            server recommends first.
          </Text>
          <Pressable
            onPress={enterFeed}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
            className="flex-row items-center justify-center bg-primary px-5 py-3.5 mt-6"
          >
            <Text className="font-ui uppercase tracking-[0.16em] text-xs text-primary-content mr-2">
              Go to the feed
            </Text>
            <ArrowRight size={15} color="#FAF4E8" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Curated shelves — same as Discover */}
        {loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator />
          </View>
        ) : sections.length > 0 ? (
          <View className="pt-7">
            {sections.map((s) => (
              <DiscoveryShelf key={s.id} section={s} baseUrl={baseUrl} />
            ))}
            <View className="px-6 pt-1">
              <Button label="Go to the feed" onPress={enterFeed} />
            </View>
          </View>
        ) : (
          <View className="px-6 py-16 items-center">
            <Text className="font-ui text-sm text-base-content/50 text-center mb-6">
              Nothing recommended yet — dive into the feed to see what's
              happening.
            </Text>
            <Button label="Go to the feed" onPress={enterFeed} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
