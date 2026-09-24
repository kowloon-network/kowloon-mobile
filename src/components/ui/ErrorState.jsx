import { View, Text, Pressable } from "react-native";

// ErrorState — error display with optional retry action. message (string),
// onRetry (optional fn).
//
// Chrome-label register + border-l-4 border-error accent bar, both adopted
// from web's ErrorState.jsx per kowloon-design/components/StateFeedback.md
// (mobile's previous per-screen versions were sentence-case with no accent
// bar). Retry wording is "Retry" (mobile's own existing shorter wording),
// not web's old "Try again" -- web moved to match this, not the other way.
//
// accessibilityLiveRegion="assertive" is RN's equivalent of web's
// aria-live="assertive" -- announces the error as soon as it renders,
// same as a screen-reader interrupt.
//
// Contract: kowloon-design/components/StateFeedback.md
export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="items-center gap-4 py-16 px-6 border-l-4 border-error"
    >
      <Text className="font-ui text-sm uppercase tracking-widest text-error text-center">
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text className="font-ui text-xs uppercase tracking-widest text-base-content/60 underline">
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
