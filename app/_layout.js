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
import { ThemeProvider, THEME_VARS } from "../src/lib/ThemeContext.jsx";
import { useColorScheme } from "nativewind";
import { View } from "react-native";

// Hold the native splash screen until fonts are ready — no flash of fallback
// text. preventAutoHideAsync can reject during fast-refresh; ignore that.
SplashScreen.preventAutoHideAsync().catch(() => {});

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

  if (!fontsLoaded && !fontError) {
    return null; // splash stays up
  }

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
                        <ShareIntentRouter />
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            contentStyle: {
                              backgroundColor: isDark ? "#15161A" : "#FFFFFF",
                            },
                          }}
                        />
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
