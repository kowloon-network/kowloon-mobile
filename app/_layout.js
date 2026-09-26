// Root layout — Expo Router entry. Every route in app/ renders inside this.
//
// Sets up: NativeWind global stylesheet, bundled fonts (held behind the splash
// screen until ready), Redux Provider, TypographyProvider, gesture root,
// safe-area provider, status bar, and the navigator Stack. Account hydration
// from AsyncStorage runs once on mount.

import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider, useDispatch } from "react-redux";
import { ShareIntentProvider } from "expo-share-intent";

import { store } from "../src/state/store.js";
import { hydrateAccounts } from "../src/state/accountsSlice.js";
import { FONT_ASSETS } from "../src/lib/typography.js";
import { TypographyProvider } from "../src/lib/TypographyContext.js";
import { UnreadCountProvider } from "../src/lib/UnreadCountContext.js";
import { PushProvider } from "../src/lib/PushProvider.jsx";
import { ShareIntentRouter } from "../src/components/ShareIntentRouter.jsx";
import { ImageViewerProvider } from "../src/components/ImageViewerProvider.jsx";
import { AudioPlayerProvider } from "../src/lib/AudioPlayerProvider.jsx";
import ToastStack from "../src/components/ui/ToastStack.jsx";
import { ThemeProvider, THEME_VARS } from "../src/lib/ThemeContext.jsx";
import { useColorScheme } from "nativewind";
import { LogBox, View } from "react-native";

// Hold the native splash screen until fonts are ready — no flash of fallback
// text. preventAutoHideAsync can reject during fast-refresh; ignore that.
SplashScreen.preventAutoHideAsync().catch(() => {});

// This one is NOT purely cosmetic: it fires when @kowloon/client's storage
// adapter falls back to MemoryStorage because the AsyncStorage native module
// didn't load, which means auth sessions won't survive a real app restart
// (see hydrateAccounts() below, which reads from AsyncStorage on mount) --
// root cause still open, see project_async_storage_native_module_gap memory.
// Suppressing the on-device LogBox popup only; the underlying console.warn
// (now including the real error) still prints to the Metro terminal.
LogBox.ignoreLogs(["React Native detected but AsyncStorage not available"]);

// Root-level error boundary (Expo Router's file-based convention: exporting
// ErrorBoundary from a layout file registers it for that segment -- here,
// the whole app). Exists specifically for one confirmed, non-deterministic,
// timing-based crash: a cold-start-via-share can hit Expo Router's own
// "Attempted to navigate before mounting the Root Layout component" /
// "action ... was not handled by any navigator" failures, thrown from deep
// inside a passive effect (NOT catchable by any try/catch around the
// triggering call -- confirmed across SIX different readiness-gating
// attempts, each disproven on-device: navReady, routeNames inclusion,
// navigationRef.isReady(), useSegments() resolving, sibling render order,
// and combinations of these). What IS confirmed, repeatedly, on-device: a
// retry from a settled state always succeeds immediately after. This isn't
// a generic "swallow all errors" boundary -- it specifically matches this
// error's own message and retries a bounded number of times with a short
// delay; anything else, or exceeding the retry budget, shows the real error
// so a genuinely different bug is never hidden.
const NAV_RACE_PATTERNS = [
  "before mounting the Root Layout",
  "was not handled by any navigator",
];
let navRaceRetries = 0;
const MAX_NAV_RACE_RETRIES = 5;

export function ErrorBoundary({ error, retry }) {
  const isNavRace = NAV_RACE_PATTERNS.some((p) => error?.message?.includes(p));
  useEffect(() => {
    if (!isNavRace || navRaceRetries >= MAX_NAV_RACE_RETRIES) return;
    navRaceRetries += 1;
    const t = setTimeout(retry, 200 * navRaceRetries);
    return () => clearTimeout(t);
  }, [isNavRace, retry]);

  if (isNavRace && navRaceRetries <= MAX_NAV_RACE_RETRIES) {
    // Same visual as the font-loading gate below -- a brief, expected beat,
    // not an error state the user should ever really perceive.
    return (
      <View className="flex-1 items-center justify-center bg-base-100" />
    );
  }

  // Anything else (or retries exhausted): a real error, not our nav race --
  // fall through to Expo Router's own default error view by re-throwing.
  throw error;
}

function HydrationBoot() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(hydrateAccounts());
  }, [dispatch]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const { colorScheme: scheme } = useColorScheme();
  const isDark = scheme === "dark";

  useEffect(() => {
    // Hide the splash once fonts resolve. On a font *error* we still proceed —
    // a missing font falls back to the system font rather than blocking boot.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // NOT gated behind fontsLoaded -- this used to `return null` here (render
  // nothing at all, no Stack) until fonts resolved, on the theory that the
  // native splash screen (still up via preventAutoHideAsync) covers it either
  // way. It does cover it visually, but withholding the Stack/navigator also
  // delayed when Expo Router actually has anything mounted to route into. A
  // share or deep link arriving during that window raced ahead of the
  // navigator's mount and hit Expo Router's own hard assertion -- "Attempted
  // to navigate before mounting the Root Layout component" -- a real crash,
  // not a caught error, confirmed via an on-device Feedly share. Rendering
  // the tree immediately (still hidden behind the native splash until
  // hideAsync() below fires) gives the navigator somewhere to land from the
  // very first frame.
  return (
    <ThemeProvider>
      <ShareIntentProvider options={{ resetOnBackground: false }}>
        <Provider store={store}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[{ flex: 1 }, isDark ? THEME_VARS.dark : THEME_VARS.light]}>
            <SafeAreaProvider>
              <TypographyProvider>
                <UnreadCountProvider>
                  <ImageViewerProvider>
                    <PushProvider>
                      <AudioPlayerProvider>
                        <StatusBar style={isDark ? "light" : "dark"} />
                        <HydrationBoot />
                        {/* Stack (and app/index.js nested inside it) MUST come
                            before ShareIntentRouter in this sibling order --
                            React fires an entire sibling subtree's passive
                            effects before moving to the next sibling, so with
                            ShareIntentRouter first (as it was), its effect ran
                            BEFORE index.js's own effect ever got a chance to
                            consume a cold-start share first, and it kept
                            racing/crashing on the exact scenario index.js was
                            supposed to own. Confirmed on-device: index.js's
                            fix alone didn't help until this ordering flipped
                            too -- ShareIntentRouter's debug overlay was still
                            the one firing. */}
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            contentStyle: {
                              backgroundColor: isDark ? "#15161A" : "#FFFFFF",
                            },
                          }}
                        />
                        <ShareIntentRouter />
                        <ToastStack />
                      </AudioPlayerProvider>
                    </PushProvider>
                  </ImageViewerProvider>
                </UnreadCountProvider>
              </TypographyProvider>
            </SafeAreaProvider>
            </View>
          </GestureHandlerRootView>
        </Provider>
      </ShareIntentProvider>
    </ThemeProvider>
  );
}
