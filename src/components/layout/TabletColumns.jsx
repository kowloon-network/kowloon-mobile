// TabletColumns — the web's 3:6:3 layout, but only on wide (landscape-tablet)
// screens. On phones/portrait it's a pass-through, so nothing changes there.
// Left column = the shared sidebar body (server info, pages, discover); center =
// the screen's content; right column reserved (empty for now, matching web).
import { useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";

import { useActiveClient } from "../../lib/useActiveClient.js";
import { SidebarBody } from "../drawer/LeftDrawer.jsx";

// Mirrors web's `lg` breakpoint (1024px) — i.e. landscape iPads and larger.
export const TABLET_MIN_WIDTH = 1024;

export function useIsWide() {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH;
}

export function TabletColumns({ children }) {
  const wide = useIsWide();
  const router = useRouter();
  const client = useActiveClient();

  if (!wide) return children;

  return (
    <View className="flex-1 flex-row bg-base-100">
      <View style={{ flex: 3 }} className="border-r border-base-300">
        <SidebarBody client={client} onNavigate={(p) => router.push(p)} />
      </View>
      <View style={{ flex: 6 }}>{children}</View>
      {/* Right column reserved (empty for now — web parity). */}
      <View style={{ flex: 3 }} className="border-l border-base-300" />
    </View>
  );
}
