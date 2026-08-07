// PostTypeSelector — the row of post types at the top of the composer.
// All five types show (icon + label); the active one is in its type color
// with a colored underline, the rest muted. Mirrors the web component.

import { Pressable, Text, View } from "react-native";

import { POST_TYPE_NAMES, POST_TYPES } from "../../lib/postTypes.js";
import { PostTypeIcon } from "./PostTypeIcon.jsx";
import { useInk } from "../../lib/useInk.js";

export function PostTypeSelector({ value, onChange }) {
  const ink = useInk();
  return (
    <View className="flex-row  ">
      {POST_TYPE_NAMES.map((type) => {
        const active = value === type;
        const color = POST_TYPES[type].color;
        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            className="flex-1 items-center pt-2.5 pb-2"
            style={
              active
                ? { borderBottomWidth: 3, borderBottomColor: color, marginBottom: -2 }
                : null
            }
          >
            <PostTypeIcon
              type={type}
              size={26}
              color={active ? color : ink(0.38)}
            />
            <Text
              className={`font-ui text-[10px] uppercase tracking-[0.08em] mt-1 ${
                active ? "text-base-content font-bold" : "text-base-content/40"
              }`}
            >
              {POST_TYPES[type].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
