// Sheet — shared bottom-sheet chrome: backdrop (tap-to-dismiss), a
// tap-swallowing inner Pressable so taps on the sheet itself don't bubble to
// the backdrop, a SafeAreaView-wrapped body pinned to the bottom, an
// optional title/eyebrow slot, and an optional two-button Cancel/confirm
// footer split evenly (ported from AddToDiscoveryModal's existing pattern).
//
// At least a dozen files hand-roll this same chrome independently -- this is
// the shared primitive, mirroring web's Modal.jsx. Only a couple of call
// sites have been migrated onto it so far; most hand-rolled sites are still
// open follow-up work, not touched by this pass.
//
// Contract: kowloon-design/components/Modal.md

import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeight = "80%",
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        {/* Inner Pressable swallows taps so they don't dismiss via the backdrop. */}
        <Pressable onPress={() => {}} style={{ maxHeight }}>
          <SafeAreaView edges={["bottom"]} className="bg-base-100">
            {title ? (
              <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/45 px-5 pt-4 pb-3">
                {title}
              </Text>
            ) : null}

            {children}

            {footer ? (
              <View className="flex-row border-t border-base-200">
                <Pressable
                  onPress={footer.onCancel ?? onClose}
                  className="flex-1 py-4 items-center"
                  android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                >
                  <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content">
                    {footer.cancelLabel ?? "Cancel"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={footer.onConfirm}
                  disabled={footer.confirmDisabled}
                  className="flex-1 py-4 items-center bg-primary"
                  style={{ opacity: footer.confirmDisabled ? 0.4 : 1 }}
                  android_ripple={{ color: "rgba(255,255,255,0.15)" }}
                >
                  <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-primary-content">
                    {footer.confirmLabel ?? "Confirm"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
