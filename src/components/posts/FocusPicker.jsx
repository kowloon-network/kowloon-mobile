// FocusPicker -- tap the subject of a photo so crops keep it in frame.
//
// Shows the whole photo with a marker at the focus point, and two small
// previews of how it'll look cropped tall (4:5, the feed's tallest) and wide
// (2:1). With no focus chosen, the server finds the subject itself after
// upload, so the marker and previews start centred and say "Automatic".
//
// focus: { x, y } fractions (0,0 = top left) or null; onChange(focus|null).

import { useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { cropPositionPercent } from "@kowloon/client";
import { SmartImage as Image } from "../ui/SmartImage.jsx";

const MAX_HEIGHT = 260;
const MARK = 28;
const PREVIEWS = [
  { label: "Tall", ratio: 4 / 5 },
  { label: "Wide", ratio: 2 },
];

export function FocusPicker({ uri, focus, onChange }) {
  const [boxWidth, setBoxWidth] = useState(0);
  const [ratio, setRatio] = useState(null); // the photo's width / height

  // Fit the whole photo: full width, unless that makes it too tall.
  let w = boxWidth;
  let h = ratio ? boxWidth / ratio : 0;
  if (h > MAX_HEIGHT) {
    h = MAX_HEIGHT;
    w = MAX_HEIGHT * ratio;
  }

  const f = focus || { x: 0.5, y: 0.5 };
  const boxRef = useRef(null);

  // Page coordinates, measured against the photo's own box: locationX/Y is
  // relative to whichever child was hit, which differs by platform.
  function onPress(e) {
    const { pageX, pageY } = e.nativeEvent;
    boxRef.current?.measure((_x, _y, bw, bh, left, top) => {
      if (!bw || !bh) return;
      const round = (n) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
      onChange({ x: round((pageX - left) / bw), y: round((pageY - top) / bh) });
    });
  }

  return (
    <View onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      <View className="bg-base-200 items-center" style={{ minHeight: ratio ? undefined : 160 }}>
        <Pressable
          ref={boxRef}
          onPress={onPress}
          accessibilityRole="adjustable"
          accessibilityLabel="Photo focus point. Tap the subject to keep it in frame when the photo is cropped."
          style={{ width: w || "100%", height: h || 160 }}
        >
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            pointerEvents="none"
            onLoad={(e) => {
              const sw = e?.source?.width;
              const sh = e?.source?.height;
              if (sw && sh) setRatio(sw / sh);
            }}
          />
          {ratio ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: f.x * w - MARK / 2,
                top: f.y * h - MARK / 2,
                width: MARK,
                height: MARK,
                borderWidth: 2,
                borderColor: "white",
                opacity: focus ? 1 : 0.6,
                shadowColor: "black",
                shadowOpacity: 0.6,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 0 },
                elevation: 3,
              }}
            >
              <View style={{ position: "absolute", left: MARK / 2 - 3, top: MARK / 2 - 3, width: 2, height: 2, backgroundColor: "white" }} />
            </View>
          ) : null}
        </Pressable>
      </View>

      <View className="flex-row items-end mt-3" style={{ gap: 10 }}>
        {PREVIEWS.map((p) => (
          <View key={p.label}>
            <View style={{ height: 64, aspectRatio: p.ratio }} className="bg-base-200 overflow-hidden">
              {ratio ? (
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  contentPosition={cropPositionPercent(ratio, p.ratio, f)}
                />
              ) : null}
            </View>
            <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55 mt-1">
              {p.label}
            </Text>
          </View>
        ))}
        <View className="flex-1 items-end">
          {focus ? (
            <Pressable onPress={() => onChange(null)} hitSlop={6} className="py-1">
              <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-primary">Automatic</Text>
            </Pressable>
          ) : (
            <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45 py-1">
              Automatic
            </Text>
          )}
        </View>
      </View>
      <Text className="font-ui text-xs text-base-content/60 mt-2">
        {focus
          ? "Crops will keep this spot in frame."
          : "Tap the subject to keep it in frame when the photo is cropped. Otherwise Kowloon picks it out."}
      </Text>
    </View>
  );
}
