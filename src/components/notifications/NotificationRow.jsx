// NotificationRow — single notification.
//
// Editorial layout: avatar on the left, summary in serif, type + relative
// time eyebrow below. A primary-color bar on the left edge marks unread; read
// rows fade. Tap fires onPress (mark read + navigate). The × dismisses.

import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { Avatar } from "../posts/Avatar.jsx";
import { NOTIF_TYPES } from "../../lib/notifications.js";
import { timeAgo } from "../../lib/timeAgo.js";
import { useInk } from "../../lib/useInk.js";

export function NotificationRow({
  notification,
  baseUrl,
  onPress,
  onDismiss,
}) {
  const ink = useInk();
  const meta = NOTIF_TYPES[notification?.type] || {
    label: notification?.type || "Notification",
    Icon: null,
  };
  const Icon = meta.Icon;
  const actor = {
    id: notification?.actorId,
    name: notification?.actorName,
    icon: notification?.actorIcon,
  };
  const unread = !notification?.read;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className={`flex-row items-center px-5 py-4   bg-base-100 ${
        unread ? "" : "opacity-60"
      }`}
    >
      {/* Unread accent bar */}
      <View
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${
          unread ? "bg-primary" : ""
        }`}
      />

      <Avatar actor={actor} size={40} baseUrl={baseUrl} />
      <View className="flex-1 ml-3 min-w-0">
        <Text
          className="font-ui text-[15px] text-base-content leading-snug"
          numberOfLines={3}
        >
          {notification?.summary || meta.label}
        </Text>
        <View className="flex-row items-center mt-1">
          {Icon ? (
            <Icon
              size={11}
              color={ink(0.55)}
              strokeWidth={1.75}
            />
          ) : null}
          <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55 ml-1.5">
            {meta.label}
          </Text>
          <Text className="font-ui text-[10px] text-base-content/40 mx-1.5">
            ·
          </Text>
          <Text className="font-ui text-[10px] text-base-content/55">
            {timeAgo(notification?.createdAt)}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        className="ml-2 p-1"
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
      >
        <X size={16} color={ink(0.45)} strokeWidth={1.75} />
      </Pressable>
    </Pressable>
  );
}
