import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

import { useInk } from "../../lib/useInk.js";

// Single text input with a thin uppercase label above. Editorial styling:
// underline only (no fill) -- border-b-2, base-300 by default, primary on
// focus, error on error. Matches web's treatment exactly; the `field` fill
// token this used to rely on is retired (see kowloon-design/components/Field.md).
//
// When `secureTextEntry` is set, a reveal toggle (eye icon) shows up inside
// the input on the right so users can confirm what they're typing — useful
// on login when a typo would otherwise just look like a wrong password.
//
// Contract: kowloon-design/components/Field.md
export function Field({
  label,
  value,
  onChangeText,
  placeholder = "",
  autoCapitalize = "none",
  autoCorrect = false,
  secureTextEntry = false,
  keyboardType = "default",
  error,
  hint,
}) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const isSecure = secureTextEntry && !revealed;
  const ink = useInk();

  const borderClass = error
    ? "border-error"
    : focused
    ? "border-primary"
    : "border-base-300";

  return (
    <View className="mb-4">
      {label ? (
        <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/70 mb-1">
          {label}
        </Text>
      ) : null}
      <View className="relative">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={ink(0.35)}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`bg-transparent border-b-2 ${borderClass} px-0 py-2.5 font-ui text-base text-base-content ${
            secureTextEntry ? "pr-11" : ""
          }`}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            className="absolute right-0 top-0 bottom-0 justify-center px-1.5"
          >
            {revealed ? (
              <EyeOff size={18} color={ink(0.55)} strokeWidth={1.75} />
            ) : (
              <Eye size={18} color={ink(0.55)} strokeWidth={1.75} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="mt-1 font-ui text-xs text-error">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 font-ui text-xs text-base-content/50">{hint}</Text>
      ) : null}
    </View>
  );
}
