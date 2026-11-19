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
import { hydrateAccounts, signOutAccount } from "../src/state/accountsSlice.js";
import { setUnauthorizedHandler } from "../src/lib/client.js";
import { FONT_ASSETS } from "../src/lib/typography.js";
import { TypographyProvider } from "../src/lib/TypographyContext.js";
import { UnreadCountProvider } from "../src/lib/UnreadCountContext.js";
import { PushProvider } from "../src/lib/PushProvider.jsx";
import { ImageViewerProvider } from "../src/components/ImageViewerProvider.jsx";
import { AudioPlayerProvider } from "../src/lib/AudioPlayerProvider.jsx";
import ToastStack from "../src/components/ui/ToastStack.jsx";
import { ThemeProvider, THEME_VARS } from "../src/lib/ThemeContext.jsx";
import { useColorScheme } from "nativewind";
import { LogBox, Pressable, Text, View } from "react-native";
import { Sentry } from "../src/lib/sentry.js";

// Hold the native splash screen until fonts are ready — no flash of fallback
// text. preventAutoHideAsync can reject during fast-refresh; ignore that.
SplashScreen.preventAutoHideAsync().catch(() => {});

// A revoked/deleted-account session (401 on a request that carried a token --
// see the server-side account-deletion work) should self-clean the same way
// a manual sign-out does, not throw an unhandled error into whatever screen
// was mid-request. Wired once at module scope -- every ensureClient() call
// happens from a screen, which only ever renders after this module has
// loaded, so the handler is always set before any request can fire.
setUnauthorizedHandler((accountId) => store.dispatch(signOutAccount(accountId)));

// This one is NOT purely cosmetic: it fires when @kowloon/client's storage
// adapter falls back to MemoryStorage because the AsyncStorage native module
// didn't load, which means auth sessions won't survive a real app restart
// (see hydrateAccounts() below, which reads from AsyncStorage on mount) --
// root cause still open, see project_async_storage_native_module_gap memory.
// Suppressing the on-device LogBox popup only; the underlying console.warn
// (now including the real error) still prints to the Metro terminal.
LogBox.ignoreLogs(["React Native detected but AsyncStorage not available"]);

// Root-level error boundary (Expo Router convention: exporting ErrorBoundary
// from the root layout covers the whole app). Shows what went wrong and a
// way out, instead of a blank screen or a crash. It used to swallow
// navigation errors behind an empty View and "recover" with
// DevSettings.reload() -- a no-op in real builds, so people were left on a
// permanent white screen (the share bug, #86, whose real cause was Android
// starting a second copy of the app: see documentLaunchMode in app.json).
export function ErrorBoundary({ error, retry }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        backgroundColor: "#FFFFFF",
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#15161A", marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: "#55565C", textAlign: "center", marginBottom: 24 }}>
        Try again. If this keeps happening, close Kowloon completely and reopen it.
      </Text>
      <Pressable
        onPress={retry}
        style={{ backgroundColor: "#002FA7", paddingVertical: 12, paddingHorizontal: 28 }}
        accessibilityRole="button"
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "700", letterSpacing: 1 }}>TRY AGAIN</Text>
      </Pressable>
      <Text selectable style={{ fontSize: 11, color: "#8A8B90", marginTop: 24, textAlign: "center" }}>
        {String(error?.message || error).slice(0, 300)}
      </Text>
    </View>
  );
}

function HydrationBoot() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(hydrateAccounts());
  }, [dispatch]);
  return null;
}

function RootLayout() {
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
                        {/* Shares into Kowloon are shown by ShareSheet,
                            mounted in the feed tab -- see that file. */}
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            contentStyle: {
                              backgroundColor: isDark ? "#15161A" : "#FFFFFF",
                            },
                          }}
                        />
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

// Sentry.wrap is a safe no-op passthrough when the SDK isn't initialized
// (no DSN) -- see src/lib/sentry.js. When it is, this adds the root-level
// native crash handler plus touch/gesture breadcrumbs.
export default Sentry.wrap(RootLayout);
