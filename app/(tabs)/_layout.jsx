// Tabs layout — the six primary destinations live here as a real Tabs
// navigator so their screens stay MOUNTED across tab switches (scroll position
// and loaded data are preserved natively). "(tabs)" is a route group, so the
// URLs are unchanged (/feed, /circles, ...). Detail screens (post, circle,
// compose, etc.) remain in the root stack and push over the tab bar.
//
// The bar itself is our custom BottomTabBar, wired to the navigator.

import { Tabs } from "expo-router";

import { BottomTabBar } from "../../src/components/nav/BottomTabBar.jsx";
import { ShareIntentRouter } from "../../src/components/ShareIntentRouter.jsx";

export default function TabsLayout() {
  return (
    <>
      {/* Moved here from the root layout -- confirmed live that useRouter()
          (and even the bare `router` singleton) called from a component
          that's a SIBLING of the root <Stack/> (not a descendant of any of
          its actual screens) resolves against the wrong navigator context:
          usePathname() correctly reported the route had changed, yet the
          visible screen never updated -- a real state/paint desync, not a
          dispatch-method issue (confirmed across .replace(), .navigate(),
          AND .push()). This file's own return value IS the content of the
          root Stack's "(tabs)" screen, so anything rendered here -- even a
          sibling of <Tabs> -- is a genuine descendant of a real Stack
          screen, the same relationship ComposeFab (nested even deeper,
          inside feed.js) has, and that's the one pattern with an actual
          working track record for pushing a root-level sibling from here.
          Stays mounted for the whole "(tabs)" lifetime (Stack screens stay
          mounted when covered, not unmounted, so pushing compose/post-
          detail/etc. on top doesn't tear this down). */}
      <ShareIntentRouter />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="circles" />
        <Tabs.Screen name="groups" />
        <Tabs.Screen name="bookmarks" />
        <Tabs.Screen name="discover" />
        <Tabs.Screen name="notifications" />
        {/* Search is reachable from the feed masthead (top toolbar), not the bar —
            it stays a mounted tab route but is hidden from BottomTabBar (no META). */}
        <Tabs.Screen name="search" />
      </Tabs>
    </>
  );
}
