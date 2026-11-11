// New Invite -- create an open link or an individual (emailed) invite. After
// creating, the screen shows the new invite's link and QR code so it can be
// shared straight away, with "Create another" and "Done".

import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { InviteCard } from "../../../src/components/admin/InviteCard.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { useInk } from "../../../src/lib/useInk.js";

function Field({ label, children }) {
  return (
    <View className="mb-4">
      <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
        {label}
      </Text>
      {children}
    </View>
  );
}

const inputCls =
  "bg-field border border-base-300 px-3 py-2.5 font-ui text-base text-base-content";

export default function NewInvite() {
  const router = useRouter();
  const client = useActiveClient();
  const ink = useInk();
  const [type, setType] = useState("open"); // open | individual
  const [email, setEmail] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const canSave =
    !saving && (type === "open" || (type === "individual" && email.trim().length > 3));

  function reset() {
    setType("open");
    setEmail("");
    setMaxRedemptions("");
    setNote("");
    setError(null);
    setCreated(null);
  }

  async function handleCreate() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const opts = { type, note: note.trim() || undefined };
      if (type === "individual") opts.email = email.trim();
      if (type === "open" && maxRedemptions.trim()) {
        const n = parseInt(maxRedemptions.trim(), 10);
        if (Number.isFinite(n) && n > 0) opts.maxRedemptions = n;
      }
      const res = await client.admin.createInvite(opts);
      setCreated(res?.invite || res?.created || res);
    } catch (e) {
      setError(e?.message || "Couldn't create the invite.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
        <AppHeader back title="Invite created" />
        <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
          <Text className="font-ui text-sm text-base-content/70 px-5 pt-5">
            {created.type === "individual"
              ? `The invitation has been emailed to ${created.email || "them"}. You can also share the link yourself.`
              : "Share this link or QR code with the people you want to invite."}
          </Text>
          <InviteCard invite={created} initiallyShowQr />
          <View className="flex-row px-5 pt-4" style={{ gap: 8 }}>
            <Pressable onPress={reset} className="flex-1 items-center py-3 border-2 border-base-300">
              <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content">Create another</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} className="flex-1 items-center py-3 bg-primary">
              <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-primary-content">Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="New Invite" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 96 }}>
            <Field label="Type">
              <View className="flex-row">
                {[
                  { key: "open", label: "Open link" },
                  { key: "individual", label: "Individual" },
                ].map((o) => {
                  const active = type === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      onPress={() => setType(o.key)}
                      className={`flex-1 items-center py-2.5 border ${
                        active ? "bg-primary border-primary" : "border-base-300"
                      }`}
                      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                    >
                      <Text
                        className={`font-ui uppercase tracking-[0.12em] text-[11px] ${
                          active ? "text-primary-content" : "text-base-content/60"
                        }`}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {type === "individual" ? (
              <Field label="Email">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="person@example.com"
                  placeholderTextColor={ink(0.35)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  className={inputCls}
                />
              </Field>
            ) : (
              <Field label="Max redemptions (optional)">
                <TextInput
                  value={maxRedemptions}
                  onChangeText={setMaxRedemptions}
                  placeholder="Unlimited"
                  placeholderTextColor={ink(0.35)}
                  keyboardType="number-pad"
                  className={inputCls}
                />
              </Field>
            )}

            <Field label="Note (optional)">
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Who or what this invite is for"
                placeholderTextColor={ink(0.35)}
                className={inputCls}
              />
            </Field>

        {error ? <Text className="font-ui text-xs text-error mb-3">{error}</Text> : null}

        <Pressable
          onPress={handleCreate}
          disabled={!canSave}
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          className={`items-center py-3 bg-primary mt-2 ${canSave ? "" : "opacity-40"}`}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FAF4E8" />
          ) : (
            <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
              Create invite
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
