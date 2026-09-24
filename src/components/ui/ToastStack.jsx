// ToastStack -- single global mount that renders the current toast queue.
// Mirrors web's ToastStack.jsx (kowloon-design/components/Toast.md): hard
// edges, theme tokens, left-edge accent bar by kind, no drop shadow.
//
// Placement: top, below the safe area -- not bottom. Mobile has a
// persistent bottom tab bar plus bottom sheets everywhere (see
// components/Modal.md), so bottom placement would collide constantly; the
// design doc leaves this open but leans top for exactly that reason.
//
// Mount once in app/_layout.js, inside SafeAreaProvider so useSafeAreaInsets
// resolves, above everything else so it renders on top.

import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useColorScheme } from "nativewind";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react-native";
import palette from "@kowloon/design/tokens/palette.json";

import { dismissToast } from "../../state/toastSlice.js";
import { useInk } from "../../lib/useInk.js";

const KIND_META = {
  success: { Icon: CheckCircle2, barClass: "border-l-success", colorKey: "success" },
  info: { Icon: Info, barClass: "border-l-primary", colorKey: "primary" },
  error: { Icon: AlertCircle, barClass: "border-l-error", colorKey: "error" },
};

function Toast({ toast }) {
  const dispatch = useDispatch();
  const ink = useInk();
  const { colorScheme } = useColorScheme();
  const meta = KIND_META[toast.kind] ?? KIND_META.info;
  const { Icon } = meta;
  const iconColor = (colorScheme === "dark" ? palette.dark : palette.light)[meta.colorKey];
  const close = () => dispatch(dismissToast(toast.id));

  useEffect(() => {
    if (!toast.durationMs) return;
    const handle = setTimeout(close, toast.durationMs);
    return () => clearTimeout(handle);
  }, [toast.id, toast.durationMs]);

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      className={`bg-base-100 border-2 border-base-300 border-l-4 ${meta.barClass} flex-row items-start gap-3 px-4 py-3 mb-2`}
      accessibilityRole="alert"
      accessibilityLiveRegion={toast.kind === "error" ? "assertive" : "polite"}
    >
      <Icon size={18} color={iconColor} strokeWidth={1.75} />
      <View className="flex-1">
        <Text className="font-ui text-sm text-base-content leading-snug">{toast.message}</Text>
        {toast.detail ? (
          <Text className="font-reading text-xs text-base-content/60 mt-0.5">{toast.detail}</Text>
        ) : null}
      </View>
      {toast.action ? (
        <Pressable
          onPress={() => {
            toast.action.onPress?.();
            close();
          }}
          hitSlop={8}
        >
          <Text className="font-ui text-xs uppercase tracking-widest text-primary">
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}
      <Pressable onPress={close} hitSlop={8} accessibilityLabel="Dismiss">
        <X size={14} color={ink(0.4)} strokeWidth={1.75} />
      </Pressable>
    </Animated.View>
  );
}

export default function ToastStack() {
  const items = useSelector((state) => state.toasts.items);
  const insets = useSafeAreaInsets();

  if (!items.length) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: insets.top + 8, left: 8, right: 8, zIndex: 300 }}
    >
      {items.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </View>
  );
}
