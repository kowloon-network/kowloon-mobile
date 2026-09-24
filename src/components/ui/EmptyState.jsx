import { View, Text } from "react-native";

// EmptyState — consistent zero-state placeholder. message (string), action
// (optional ReactNode, e.g. a "Create one" Button).
//
// Chrome-label register (text-sm uppercase tracking-widest) -- matches
// web's EmptyState.jsx, adopted here per kowloon-design/components/
// StateFeedback.md: mobile's previous per-screen versions were larger,
// sentence-case, and read as a friendly sentence rather than a label.
//
// Contract: kowloon-design/components/StateFeedback.md
export function EmptyState({ message = "Nothing here yet.", action }) {
  return (
    <View className="items-center gap-4 py-16 px-6">
      <Text className="font-ui text-sm uppercase tracking-widest text-base-content/65 text-center">
        {message}
      </Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
