// GroupCard — list row for groups. Shows icon, name, visibility tag, RSVP
// policy hint, and member count (when present in the source payload — joined
// groups come from the user's Groups system circle as compact subdocs with
// only id/name/icon, so policy and count just won't render).

import { Pressable, Text, View } from "react-native";

import { GroupAvatar } from "./GroupAvatar.jsx";
import {
  groupVisibilityLabel,
  rsvpPolicyLabel,
} from "../../lib/groups.js";

export function GroupCard({ group, serverDomain, baseUrl, onPress }) {
  const visibility = groupVisibilityLabel(group?.to, serverDomain);
  const memberCount = group?.memberCount;
  const hasMeta = typeof group?.to === "string" || typeof memberCount === "number";

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="flex-row items-center px-5 py-4   bg-base-100"
    >
      <GroupAvatar group={group} size={44} baseUrl={baseUrl} />
      <View className="flex-1 ml-3 min-w-0">
        <Text
          className="font-ui text-lg text-base-content leading-tight"
          numberOfLines={1}
        >
          {group?.name}
        </Text>
        {hasMeta ? (
          <View className="flex-row items-center mt-0.5 flex-wrap">
            {group?.to ? (
              <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/55">
                {visibility}
              </Text>
            ) : null}
            {group?.rsvpPolicy ? (
              <>
                <Text className="font-ui text-[11px] text-base-content/40 mx-1.5">
                  ·
                </Text>
                <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/55">
                  {rsvpPolicyLabel(group.rsvpPolicy)}
                </Text>
              </>
            ) : null}
            {typeof memberCount === "number" ? (
              <>
                <Text className="font-ui text-[11px] text-base-content/40 mx-1.5">
                  ·
                </Text>
                <Text className="font-ui text-[11px] uppercase tracking-[0.14em] text-base-content/55">
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
        {group?.summary ? (
          <Text
            className="font-ui text-xs text-base-content/70 leading-snug mt-1"
            numberOfLines={2}
          >
            {group.summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
