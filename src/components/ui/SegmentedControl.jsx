import { Pressable, Text, View } from "react-native";

// Editorial segmented control — a row of hard-edged segments sharing a 2px
// frame. Active segment fills with primary. Discrete steps, no slider.
// `options`: [{ value, label }]
//
// The active fill lives on an inner <View>, NOT on the Pressable: on Android the
// Pressable's `android_ripple` drawable IS that node's background, so a
// backgroundColor set on the same node gets masked and won't repaint when it
// changes (the highlight would stick on the previous segment). A plain child
// View has its own background layer and repaints reliably. Label color is inline
// on the <Text> (its own node), which is why that part already worked.
export function SegmentedControl({ options, value, onChange }) {
  return (
    <View className="flex-row  ">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-1"
            android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          >
            <View
              className="py-3 items-center"
              style={{ backgroundColor: active ? "#5588B1" : "#FFFFFF" }}
            >
              <Text
                className={`font-ui text-xs uppercase tracking-[0.12em] ${active ? "font-bold" : ""}`}
                style={{ color: active ? "#F4F5F7" : "#1A1A20" }}
              >
                {opt.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
