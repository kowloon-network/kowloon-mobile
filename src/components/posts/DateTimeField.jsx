// DateTimeField — one row of split date + time tappables for the Event
// composer. Tapping either side opens the native date or time picker
// (@react-native-community/datetimepicker). Values are kept as separate
// string parts (`YYYY-MM-DD` / `HH:MM`) per project_event_datetime_logic;
// the parent composer composes them into ISO timestamps at submit time.

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const pad = (n) => String(n).padStart(2, "0");

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDate(value) {
  if (!value) return new Date();
  // Pin to local-midnight so the picker shows the correct date in any zone.
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function parseTime(value) {
  const d = new Date();
  if (!value) {
    d.setSeconds(0, 0);
    return d;
  }
  const [h, m] = value.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function DateTimeField({
  label,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
}) {
  const [mode, setMode] = useState(null); // 'date' | 'time' | null

  const pickerValue =
    mode === "date" ? parseDate(dateValue) : parseTime(timeValue);

  function onPickerChange(event, selected) {
    // Android closes the modal automatically; we still reset our flag.
    setMode(null);
    if (event?.type !== "set" || !selected) return;
    if (mode === "date") onDateChange(isoDate(selected));
    else if (mode === "time") onTimeChange(isoTime(selected));
  }

  return (
    <View>
      {label ? (
        <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55 mb-1">
          {label}
        </Text>
      ) : null}
      <View className="flex-row   bg-field">
        <Pressable
          onPress={() => setMode("date")}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          className="flex-1 px-3 py-3  "
        >
          <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content/45 mb-0.5">
            Date
          </Text>
          <Text className="font-ui text-base text-base-content">
            {dateValue || "—"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("time")}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          className="flex-1 px-3 py-3"
        >
          <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content/45 mb-0.5">
            Time
          </Text>
          <Text className="font-ui text-base text-base-content">
            {timeValue || "—"}
          </Text>
        </Pressable>
      </View>
      {mode ? (
        <DateTimePicker
          value={pickerValue}
          mode={mode}
          is24Hour
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}
