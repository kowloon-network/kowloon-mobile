import { Pressable, View } from "react-native";

import { PostTypeIcon } from "./PostTypeIcon.jsx";
import { POST_TYPE_NAMES, POST_TYPES } from "../../lib/postTypes.js";
import { useInk } from "../../lib/useInk.js";

export function TypeFilter({ activeTypes = [], onSetTypes }) {
  const ink = useInk();
  const isAll = !activeTypes || activeTypes.length === 0;

  function handlePress(type) {
    if (isAll) {
      // All on — solo this one type
      onSetTypes([type]);
    } else if (activeTypes.includes(type)) {
      // Remove this type; empty result wraps back to all
      const next = activeTypes.filter((t) => t !== type);
      onSetTypes(next);
    } else {
      // Add this type; if now all selected, normalize to []
      const next = [...activeTypes, type];
      onSetTypes(next.length === POST_TYPE_NAMES.length ? [] : next);
    }
  }

  return (
    <View className="flex-row items-center" style={{ gap: 16 }}>
      {POST_TYPE_NAMES.map((type) => {
        const active = isAll || activeTypes.includes(type);
        return (
          <Pressable key={type} onPress={() => handlePress(type)} hitSlop={8}>
            <PostTypeIcon
              type={type}
              size={20}
              color={active ? POST_TYPES[type].color : ink(0.15)}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
