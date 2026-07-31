// AudioAttachment — a play row for an audio attachment. Playback goes through
// the one global audio bar (issue #83), so only one clip plays at a time and it
// gets the persistent controls + queue. Tapping loads/toggles it in the bar.

import { Pressable, Text, View } from "react-native";
import { useAudioBar } from "../../lib/AudioPlayerProvider.jsx";

export function AudioAttachment({ att }) {
  const audio = useAudioBar();
  const id = att.id || att.url;
  const isCurrent = audio?.current?.id === id;
  const playing = isCurrent && audio?.playing;

  return (
    <View className="bg-base-200 mb-2">
      <Pressable
        onPress={() =>
          audio?.requestTrack({ id, url: att.url, title: att.name || "Audio" })
        }
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        className="flex-row items-center px-3 py-3"
      >
        <Text className="font-ui text-lg text-base-content w-7">
          {playing ? "⏸" : "▶"}
        </Text>
        <Text className="font-ui text-sm text-base-content flex-1 mx-2" numberOfLines={1}>
          {att.name || "Audio"}
        </Text>
        {isCurrent ? (
          <Text className="font-ui text-[9px] uppercase tracking-[0.14em] text-primary">
            In player
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
