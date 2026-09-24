import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
import palette from "@kowloon/design/tokens/palette.json";

// Editorial button — hard edges (no rounding), uppercase label.
// `variant` controls fill: primary | secondary | accent | ghost.
// `size` controls padding/text scale: sm | md | lg (mirrors web's classes
// exactly -- NativeWind supports the same utility strings).
// `loading` disables the button and replaces the label with a spinner.
//
// Contract: kowloon-design/components/Button.md

const CONTENT_KEY = {
  primary: "primary-content",
  secondary: "secondary-content",
  accent: "accent-content",
  ghost: "base-content",
};

// primary-content and base-content differ between light/dark (most
// *-content tokens don't) -- ActivityIndicator takes a literal color, not a
// className, so this resolves the exact hex for the current scheme rather
// than hardcoding one value for every variant/mode like the previous
// implementation did.
function useContentColor(variant) {
  const { colorScheme } = useColorScheme();
  const p = colorScheme === "dark" ? palette.dark : palette.light;
  return p[CONTENT_KEY[variant]];
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className = "",
}) {
  const isDisabled = disabled || loading;
  const contentColor = useContentColor(variant);

  // Disabled dims only the fill, not the label (see Button.md) -- ghost has
  // no fill to dim.
  const bg = {
    primary: isDisabled ? "bg-primary/60" : "bg-primary",
    secondary: isDisabled ? "bg-secondary/60" : "bg-secondary",
    accent: isDisabled ? "bg-accent/60" : "bg-accent",
    ghost: "bg-transparent",
  }[variant];
  const fg = {
    primary: "text-primary-content",
    secondary: "text-secondary-content",
    accent: "text-accent-content",
    ghost: "text-base-content",
  }[variant];
  // Same classes as web's `sizes` map, so the two scales can't drift apart.
  const sizePad = {
    sm: "px-3 py-1.5",
    md: "px-4 py-2",
    lg: "px-6 py-3",
  }[size];
  const sizeText = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      className={`${bg} ${sizePad} ${className}`}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
    >
      <View className="flex-row items-center justify-center">
        {loading ? (
          <ActivityIndicator color={contentColor} />
        ) : (
          <Text className={`font-ui uppercase tracking-[0.16em] ${sizeText} ${fg}`}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
