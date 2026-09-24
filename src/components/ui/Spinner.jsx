import { ActivityIndicator, View } from "react-native";
import { useColorScheme } from "nativewind";
import palette from "@kowloon/design/tokens/palette.json";

// Spinner — loading state indicator. size: sm | md | lg. centered wraps it
// in a full-width vertically-padded box (matches web's `centered` prop).
//
// ActivityIndicator takes a literal color, not a className -- resolves
// primary's exact hex for the current scheme rather than hardcoding one
// value, same pattern as Button's useContentColor.
//
// Contract: kowloon-design/components/StateFeedback.md
const RN_SIZE = { sm: "small", md: "small", lg: "large" };

export function Spinner({ size = "md", centered = false }) {
  const { colorScheme } = useColorScheme();
  const color = (colorScheme === "dark" ? palette.dark : palette.light).primary;

  const indicator = <ActivityIndicator size={RN_SIZE[size]} color={color} />;

  if (centered) {
    return (
      <View className="items-center justify-center w-full py-12">
        {indicator}
      </View>
    );
  }

  return indicator;
}
