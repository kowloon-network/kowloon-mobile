// FeedHeader — single-line bar: view selector + contextual action (left), type
// icons and the defaults overflow menu (right). The action (Copy a circle /
// Join a group) appears only when you're reading someone else's circle or group.

import { View, Text } from "react-native";

import { FeedViewSelector } from "./FeedViewSelector.jsx";
import { FeedViewAction } from "./FeedViewAction.jsx";
import { TypeFilter } from "./TypeFilter.jsx";
import { FeedDefaultsMenu } from "./FeedDefaultsMenu.jsx";
import { useFeedSubject } from "../../lib/useFeedSubject.js";

export function FeedHeader({
  viewKey,
  onViewChange,
  activeTypes,
  onSetTypes,
  isViewDefault,
  isTypesDefault,
  onSetDefaultView,
  onSetDefaultTypes,
}) {
  // Resolve the circle/group behind the current view once, here — both the
  // selector's label fallback and the contextual action read from it.
  const { kind, subject, isOwner } = useFeedSubject(viewKey);

  return (
    <View className="flex-row items-end px-5 pt-2.5 pb-5">
      <View className="flex-1 min-w-0">
        <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45 mb-1">
          Current feed
        </Text>
        <View className="flex-row items-center">
          <View className="flex-shrink min-w-0">
            <FeedViewSelector
              value={viewKey}
              onChange={onViewChange}
              subject={subject}
            />
          </View>
          <View className="flex-shrink-0 ml-2">
            <FeedViewAction kind={kind} subject={subject} isOwner={isOwner} />
          </View>
        </View>
      </View>
      <View className="flex-shrink-0 items-end">
        <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45 mb-1">
          Post Types
        </Text>
        <View className="flex-row items-center">
          <TypeFilter activeTypes={activeTypes} onSetTypes={onSetTypes} />
          <FeedDefaultsMenu
            isViewDefault={isViewDefault}
            isTypesDefault={isTypesDefault}
            onSetDefaultView={onSetDefaultView}
            onSetDefaultTypes={onSetDefaultTypes}
          />
        </View>
      </View>
    </View>
  );
}
