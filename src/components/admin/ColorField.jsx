// ColorField — one theme color field: label + hint, a swatch that opens a
// picker sheet, and a text field for exact values (hex or oklch).
//
// The swatch's own background is set directly from the raw value (valid CSS
// accepts oklch() natively), not from the picker library's internal state --
// that's the only way it renders correctly for oklch-based theme values, not
// just plain hex. reanimated-color-picker only understands hex/rgb, so the
// picker sheet itself opens seeded with a best-effort hex approximation
// (gray, if the current value isn't already hex) and always WRITES hex back
// out -- picking a color always resolves any oklch value to hex, typing in
// the text field is the only way to set an oklch value by hand.

import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ColorPicker, { Panel1, HueSlider, Preview } from "reanimated-color-picker";

import { Button } from "../ui/Button.jsx";
import { useInk } from "../../lib/useInk.js";

const HEX_RE = /^#[0-9a-f]{6}$/i;
const swatchSeed = (v) => (HEX_RE.test(v) ? v : "#888888");

export function ColorField({ label, hint, token, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(swatchSeed(value));
  const ink = useInk();

  return (
    <View className="flex-1 min-w-[45%] gap-1">
      <Text className="font-ui text-xs text-base-content/80">{label}</Text>
      {hint ? (
        <Text className="font-reading text-[11px] text-base-content/40 italic -mt-0.5">
          {hint}
        </Text>
      ) : null}

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => {
            setDraft(swatchSeed(value));
            setOpen(true);
          }}
          style={{ backgroundColor: value || "#888888" }}
          className="w-10 h-10 border border-base-300"
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="#hex or oklch(…)"
          placeholderTextColor={ink(0.3)}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 min-w-0 border border-base-300 bg-base-100 px-2 py-2 font-mono text-xs text-base-content"
        />
      </View>
      {token ? (
        <Text className="font-mono text-[10px] text-base-content/30">{token}</Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={["bottom"]} className="bg-base-100">
              <View className="px-5 pt-5 pb-2">
                <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 mb-4">
                  {label}
                </Text>
                <ColorPicker
                  value={draft}
                  onCompleteJS={(c) => setDraft(c.hex)}
                  style={{ gap: 18 }}
                >
                  <Preview style={{ height: 40, borderRadius: 0 }} />
                  <Panel1 style={{ height: 160, borderRadius: 0 }} />
                  <HueSlider style={{ borderRadius: 0 }} />
                </ColorPicker>
              </View>
              <View className="flex-row px-5 pb-3 pt-2 gap-3">
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setOpen(false)}
                  className="flex-1"
                />
                <Button
                  label="Use Color"
                  onPress={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                  className="flex-1"
                />
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
