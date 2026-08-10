// AppHeader — the app header. White (base-100) with dark text/icons, a hairline
// bottom border, and its own SafeAreaView through the status bar. Screens using
// this should drop the "top" edge from their own SafeAreaView (keep left/right).
//
// Slots:
//   title  — title text (omit when `left` carries its own content)
//   back   — render a back chevron (for pushed screens; omit on tab roots)
//   left   — override the leading slot entirely (e.g. the feed server toggle)
//   right  — trailing node, e.g. a <HeaderButton>

import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useInk } from "../../lib/useInk.js";

export function AppHeader({
  title,
  back = false,
  onBack,
  left = null,
  right = null,
  transparent = false, // float over a hero (e.g. Discover): no bg, white content
}) {
  const router = useRouter();
  const ink = useInk();
  const iconColor = transparent ? "#FFFFFF" : ink(0.85);
  return (
    <SafeAreaView
      edges={["top"]}
      className={transparent ? "" : "bg-base-100 border-b border-base-300"}
    >
      <View
        className="flex-row items-center px-5 pt-2 pb-3"
        style={{ minHeight: 54 }}
      >
        {left ? (
          left
        ) : back ? (
          <Pressable
            onPress={onBack || (() => router.back())}
            hitSlop={8}
            android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
            className="mr-3"
          >
            <ChevronLeft size={26} color={iconColor} strokeWidth={1.75} />
          </Pressable>
        ) : null}

        {title ? (
          <Text
            className={`font-ui text-2xl flex-1 ${
              transparent ? "text-white" : "text-base-content"
            }`}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : left ? null : (
          <View className="flex-1" />
        )}

        {right}
      </View>
    </SafeAreaView>
  );
}

// Outlined action button sized for the header (New, Mark all read, etc.).
export function HeaderButton({ label, icon, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      className="flex-row items-center   px-3 py-1.5"
    >
      {icon || null}
      <Text
        className={`font-ui uppercase tracking-[0.16em] text-[11px] text-base-content ${
          icon ? "ml-1.5" : ""
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
