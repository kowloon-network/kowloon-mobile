// FlagSheet -- bottom sheet for reporting a post, person, reply or group.
// ReportSheet (below) wraps it with the submit step for any target.
//
// Fetches flagOptions from GET / (settings.flagOptions) when opened so the
// list always reflects whatever the server admin has configured. Falls back to
// a minimal hardcoded set if the server info fetch fails.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  Alert,
} from "react-native";

const FALLBACK_REASONS = [
  { key: "spam", label: "Spam", description: "Unwanted commercial or repetitive content." },
  { key: "harassment", label: "Harassment or Bullying", description: "Targeted insults or abusive behavior." },
  { key: "misinformation", label: "Misinformation", description: "False or misleading claims." },
  { key: "other", label: "Other", description: "Anything objectionable not covered by the other categories." },
];

export function FlagSheet({ visible, onClose, onSubmit, client, noun = "post" }) {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch server's configured flag options each time the sheet opens.
  // Results aren't cached here — the server round-trip is fast, and
  // caching would stale if an admin changes the options between opens.
  useEffect(() => {
    if (!visible || !client) return;
    let cancelled = false;
    setLoading(true);
    client.feeds
      .getServerInfo()
      .then((info) => {
        if (cancelled) return;
        const opts = info?.settings?.flagOptions;
        if (opts && typeof opts === "object" && Object.keys(opts).length > 0) {
          setReasons(
            Object.entries(opts).map(([key, val]) => ({
              key,
              label: val?.label || key,
              description: val?.description || "",
            }))
          );
        } else {
          setReasons(FALLBACK_REASONS);
        }
      })
      .catch(() => {
        if (!cancelled) setReasons(FALLBACK_REASONS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, client]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Dimmed backdrop — tap anywhere outside the panel to cancel */}
      <Pressable
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
        onPress={onClose}
      >
        {/* Panel — stop tap propagation so it doesn't close on inner taps */}
        <Pressable
          onPress={() => {}}
          style={{ maxHeight: "75%" }}
          className="bg-base-100  "
        >
          {/* Header */}
          <View className="px-5 pt-4 pb-3  ">
            <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/45 mb-1.5">
              Report {noun}
            </Text>
            <Text className="font-ui text-sm text-base-content/70">
              Choose the reason that fits best. Only this server's moderators see your report.
            </Text>
          </View>

          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator />
            </View>
          ) : (
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
              {reasons.map((r, i) => (
                <Pressable
                  key={r.key}
                  onPress={() => onSubmit(r.key)}
                  android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                  className={`px-5 py-3.5 ${
                    i < reasons.length - 1 ? " " : ""
                  }`}
                >
                  <Text className="font-ui text-sm text-base-content">
                    {r.label}
                  </Text>
                  {r.description ? (
                    <Text
                      className="font-ui text-xs text-base-content/50 mt-0.5"
                      numberOfLines={2}
                    >
                      {r.description}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Cancel — full-width, heavy  on top to visually separate */}
          <Pressable
            onPress={onClose}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            className="  px-5 py-4 items-center"
          >
            <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content">
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Report anything: opens the reason list and files the Flag. `noun` is what
// the person is reporting ("person", "reply", "group") for the heading and
// the thank-you message.
export function ReportSheet({ visible, onClose, client, targetId, noun = "post" }) {
  async function submit(reason) {
    onClose();
    try {
      await client.activities.flag({ targetId, reason });
      Alert.alert("Reported", `Thanks. A moderator will review this ${noun}.`);
    } catch (e) {
      Alert.alert("Couldn't report", e?.message || "Please try again.");
    }
  }
  return (
    <FlagSheet visible={visible} onClose={onClose} onSubmit={submit} client={client} noun={noun} />
  );
}
