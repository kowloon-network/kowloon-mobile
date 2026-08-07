import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

import { useInk } from "../../lib/useInk.js";

// Single text input with a thin uppercase label above. Editorial styling:
// no rounding, 2px bottom  that shifts to primary on focus is
// future work — for now we render a 2px box  on all sides for clarity.
//
// When `secureTextEntry` is set, a reveal toggle (eye icon) shows up inside
// the input on the right so users can confirm what they're typing — useful
// on login when a typo would otherwise just look like a wrong password.
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
  const isSecure = secureTextEntry && !revealed;
  const ink = useInk();

  return (
    <View className="mb-4">
      {label ? (
        <Text className="font-ui uppercase tracking-[0.22em] text-[11px] text-base-content/70 mb-1">
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
          className={`  bg-field px-3 py-3 font-ui text-base text-base-content ${
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
            className="absolute right-2 top-0 bottom-0 justify-center px-1.5"
          >
            {revealed ? (
              <EyeOff
                size={18}
                color={ink(0.55)}
                strokeWidth={1.75}
              />
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
