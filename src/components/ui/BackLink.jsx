// BackLink — the small "< Back" breadcrumb that sits at the top of detail
// screens. iOS doesn't have a system back gesture for non-stack-pushed
// screens, and even Android users appreciate an in-screen back affordance
// they can tap with one thumb. Editorial styling — uppercase eyebrow type.

import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useInk } from "../../lib/useInk.js";

export function BackLink({ label = "Back", className = "" }) {
  const router = useRouter();
  const ink = useInk();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
      className={`flex-row items-center self-start ${className}`}
    >
      <View className="mr-1">
        <ChevronLeft size={14} color={ink(0.65)} strokeWidth={1.75} />
      </View>
      <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/65">
        {label}
      </Text>
    </Pressable>
  );
}
