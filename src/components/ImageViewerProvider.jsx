// ImageViewerProvider — tap any post image to view it fullscreen.
//
// Pinch-to-zoom, pan, and double-tap-to-zoom via react-native-awesome-gallery
// (rides the app's gesture-handler + reanimated). Swipe between multiple images;
// swipe down to close. Long-press (or the top-right menu) opens an action sheet
// to Save the image, Share it as a new Media post, or hand it to the OS share
// sheet. Render items use expo-image so animated GIFs animate here too.

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Gallery from "react-native-awesome-gallery";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { MoreVertical, X } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

import { setPendingShare } from "../lib/pendingShare.js";

const ImageViewerContext = createContext(null);

export function useImageViewer() {
  return useContext(ImageViewerContext);
}

function extFor(mime = "") {
  const m = mime.toLowerCase();
  if (m.includes("gif")) return "gif";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  return "jpg";
}

export function ImageViewerProvider({ children }) {
  const [state, setState] = useState(null); // { data: [uri], meta: [{title,alt}] } | null
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Tracks the currently-visible image so Save/Share + the caption overlay act
  // on the right one. indexRef is for the async handlers; currentIndex re-renders
  // the overlay on swipe.
  const indexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Accepts an array of image URLs (strings) or { uri, title, alt } objects, so
  // the caption overlay can show each image's title/alt when available.
  const open = useCallback((items, index = 0) => {
    const list = (Array.isArray(items) ? items : [items]).filter(Boolean);
    const data = list.map((it) => (typeof it === "string" ? it : it.uri || it.url)).filter(Boolean);
    const meta = list.map((it) =>
      typeof it === "string" ? {} : { title: it.title || "", alt: it.alt || "" }
    );
    if (data.length) {
      const i = Math.max(0, index);
      indexRef.current = i;
      setCurrentIndex(i);
      setState({ data, meta });
    }
  }, []);

  const close = useCallback(() => {
    setState(null);
    setMenuOpen(false);
  }, []);

  const currentUrl = () => state?.data?.[indexRef.current] || null;

  // Download the current image to the cache with a correct extension (from the
  // response content-type), returning { uri, name, mime }.
  async function downloadCurrent() {
    const url = currentUrl();
    if (!url) throw new Error("No image selected");
    const stamp = Date.now();
    const tmp = `${FileSystem.cacheDirectory}kowloon-${stamp}`;
    const res = await FileSystem.downloadAsync(url, tmp);
    const mime =
      res.headers?.["content-type"] ||
      res.headers?.["Content-Type"] ||
      "image/jpeg";
    const name = `kowloon-${stamp}.${extFor(mime)}`;
    const finalUri = `${FileSystem.cacheDirectory}${name}`;
    try {
      await FileSystem.moveAsync({ from: res.uri, to: finalUri });
      return { uri: finalUri, name, mime };
    } catch {
      return { uri: res.uri, name, mime };
    }
  }

  async function handleSave() {
    setMenuOpen(false);
    setBusy(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo access to save images.");
        return;
      }
      const { uri } = await downloadCurrent();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved", "Image saved to your photos.");
    } catch (e) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShareAsPost() {
    setMenuOpen(false);
    setBusy(true);
    try {
      const { uri, name, mime } = await downloadCurrent();
      setPendingShare({ kind: "files", files: [{ uri, name, mimeType: mime }] });
      close();
      router.push("/compose?fromShare=1");
    } catch (e) {
      Alert.alert("Couldn't share", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOsShare() {
    setMenuOpen(false);
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Unavailable", "Sharing isn't available on this device.");
        return;
      }
      const { uri, mime } = await downloadCurrent();
      await Sharing.shareAsync(uri, { mimeType: mime });
    } catch (e) {
      Alert.alert("Couldn't share", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const { width, height } = Dimensions.get("window");
  const cap = state?.meta?.[currentIndex] || {};
  const capTitle = (cap.title || "").trim();
  const capAlt = (cap.alt || "").trim();

  return (
    <ImageViewerContext.Provider value={{ open }}>
      {children}

      <Modal
        visible={!!state}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-black">
            {state ? (
              <Gallery
                data={state.data}
                initialIndex={currentIndex}
                onIndexChange={(i) => {
                  indexRef.current = i;
                  setCurrentIndex(i);
                }}
                onSwipeToClose={close}
                onLongPress={() => setMenuOpen(true)}
                renderItem={({ item, setImageDimensions }) => (
                  <ExpoImage
                    source={{ uri: item }}
                    style={{ width, height }}
                    contentFit="contain"
                    onLoad={(e) => {
                      const w = e?.source?.width;
                      const h = e?.source?.height;
                      if (w && h) setImageDimensions({ width: w, height: h });
                    }}
                  />
                )}
              />
            ) : null}

            {/* Top bar — close (left) + menu (right), with the image title below */}
            <SafeAreaView
              edges={["top"]}
              className="absolute top-0 left-0 right-0"
              pointerEvents="box-none"
            >
              <View
                className="flex-row items-center justify-between"
                pointerEvents="box-none"
              >
                <Pressable
                  onPress={close}
                  hitSlop={12}
                  className="m-4 p-2 bg-white/10"
                  android_ripple={{ color: "rgba(255,255,255,0.2)", borderless: true }}
                >
                  <X size={26} color="#FFFFFF" strokeWidth={2} />
                </Pressable>
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  hitSlop={12}
                  className="m-4 p-2 bg-white/10"
                  android_ripple={{ color: "rgba(255,255,255,0.2)", borderless: true }}
                  accessibilityLabel="Image options"
                >
                  <MoreVertical size={24} color="#FFFFFF" strokeWidth={2} />
                </Pressable>
              </View>
              {capTitle ? (
                <View className="px-4 pb-2" pointerEvents="none">
                  <Text
                    className="font-reading text-2xl text-white"
                    numberOfLines={2}
                    style={{
                      textShadowColor: "rgba(0,0,0,0.85)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 4,
                    }}
                  >
                    {capTitle}
                  </Text>
                </View>
              ) : null}
            </SafeAreaView>

            {/* Alt text — bottom, white on 60% black for legibility over light images */}
            {capAlt ? (
              <SafeAreaView
                edges={["bottom"]}
                className="absolute bottom-0 left-0 right-0 bg-black/60"
                pointerEvents="none"
              >
                <Text className="font-ui text-sm text-white px-4 py-3 leading-5">
                  {capAlt}
                </Text>
              </SafeAreaView>
            ) : null}

            {busy ? (
              <View className="absolute inset-0 items-center justify-center bg-black/40">
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* Action sheet — Save / Share as post / OS share */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setMenuOpen(false)}
        >
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={["bottom"]} className="bg-base-100">
              <MenuRow label="Save to Photos" onPress={handleSave} />
              <MenuRow label="Share as Media Post" onPress={handleShareAsPost} />
              <MenuRow label="Share to Other Apps" onPress={handleOsShare} />
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageViewerContext.Provider>
  );
}

function MenuRow({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      className="px-6 py-4"
    >
      <Text className="font-ui text-base text-base-content">{label}</Text>
    </Pressable>
  );
}
