// BottomTabBar — the app's primary navigation, rendered by the (tabs) Tabs
// navigator (see app/(tabs)/_layout.jsx). Because it's the navigator's tab bar,
// switching tabs preserves each screen's mounted state (scroll + data) instead
// of remounting it.
//
// Five destinations: Feed · Circles · Groups · Discover · Notify. Notify carries
// the unread-count badge. Search moved to the feed masthead (top toolbar); the
// user's own profile is reached from the account avatar in the header.

import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Home, Hexagon, Users, Compass, Bell } from "lucide-react-native";

import { useUnreadCount } from "../../lib/UnreadCountContext.js";

// Route name (file name under app/(tabs)) -> label + icon. Routes without an
// entry here (e.g. "search") stay mounted but are hidden from the bar.
const META = {
  feed: { label: "Feeds", Icon: Home },
  circles: { label: "Circles", Icon: Hexagon },
  groups: { label: "Groups", Icon: Users },
  discover: { label: "Discover", Icon: Compass },
  notifications: { label: "Notify", Icon: Bell },
};

const ACTIVE = "#5588B1"; // primary
const INACTIVE = "rgba(26,26,32,0.5)"; // ink /50

export function BottomTabBar({ state, navigation }) {
  const { count } = useUnreadCount();

  return (
    <SafeAreaView
      edges={["bottom"]}
      className="bg-base-100  "
    >
      <View className="flex-row">
        {state.routes.map((route, index) => {
          const meta = META[route.name];
          if (!meta) return null;
          const on = state.index === index;
          const showBadge = route.name === "notifications" && count > 0;
          const { Icon } = meta;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!on && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
              className="flex-1 items-center pt-2 pb-1"
            >
              <View>
                <Icon
                  size={22}
                  color={on ? ACTIVE : INACTIVE}
                  strokeWidth={1.75}
                />
                {showBadge ? (
                  <View className="absolute -top-1.5 -right-2 bg-accent   min-w-[16px] h-4 items-center justify-center px-1">
                    <Text className="font-ui text-[9px] font-bold text-accent-content">
                      {count > 99 ? "99+" : count}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                className={`font-ui uppercase tracking-[0.14em] text-[9px] mt-1 ${
                  on ? "text-base-content" : "text-base-content/50"
                }`}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
