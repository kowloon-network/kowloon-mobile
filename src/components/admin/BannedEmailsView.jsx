// Banned email addresses and email domains -- checked at signup, email change
// and individual invites. Admin-only. Used by the Moderation screen.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useActiveClient } from "../../lib/useActiveClient.js";
import { useInk } from "../../lib/useInk.js";
import { fmtDate } from "./ReportsList.jsx";
import { Label, SmallButton, inputCls } from "./BlocklistView.jsx";

const SECTIONS = [
  {
    kind: "email",
    key: "emails",
    title: "Addresses",
    placeholder: "person@example.com",
    empty: "No banned addresses.",
  },
  {
    kind: "domain",
    key: "domains",
    title: "Domains",
    placeholder: "example.com",
    empty: "No banned domains.",
  },
];

function Section({ section, items, onAdd, onRemove }) {
  const ink = useInk();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  async function add() {
    if (!value.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await onAdd(section.kind, value.trim(), note.trim());
      setValue("");
      setNote("");
    } catch (e) {
      setError(e?.message || "Couldn't add that.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <View className="mb-8">
      <Text className="font-reading text-2xl text-base-content border-b-2 border-base-300 pb-2 mb-3">
        {section.title}
      </Text>

      <Label>{section.kind === "email" ? "Address" : "Domain"}</Label>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={section.placeholder}
        placeholderTextColor={ink(0.35)}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        className={`${inputCls} mb-3`}
      />
      <Label>Note (optional)</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Why it's banned"
        placeholderTextColor={ink(0.35)}
        className={`${inputCls} mb-3`}
      />
      {error ? <Text className="font-ui text-xs text-error mb-3">{error}</Text> : null}
      <View className="flex-row mb-4">
        <SmallButton primary label={adding ? "Adding" : "Add"} onPress={add} disabled={adding || !value.trim()} />
      </View>

      {items.length === 0 ? (
        <View className="border-y border-base-200 py-5 items-center">
          <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/45">
            {section.empty}
          </Text>
        </View>
      ) : (
        <View className="border-t border-base-200">
          {items.map((it) => (
            <View key={it.value} className="flex-row items-center py-3 border-b border-base-200">
              <View className="flex-1 min-w-0 mr-2">
                <Text numberOfLines={1} className="font-ui text-sm text-base-content">
                  {it.value}
                </Text>
                {it.note ? (
                  <Text numberOfLines={2} className="font-ui text-xs text-base-content/60 mt-0.5">
                    {it.note}
                  </Text>
                ) : null}
                {it.addedAt ? (
                  <Text className="font-ui text-[11px] text-base-content/45 mt-0.5">{fmtDate(it.addedAt)}</Text>
                ) : null}
              </View>
              <SmallButton danger label="Remove" onPress={() => onRemove(section.kind, it.value)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function BannedEmailsView() {
  const client = useActiveClient();

  const [data, setData] = useState({ emails: [], domains: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.admin.getBannedEmails();
        setData({ emails: res?.emails || [], domains: res?.domains || [] });
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load banned emails."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd(kind, value, note) {
    await client.admin.addBannedEmail({ kind, value, note: note || undefined });
    await load({ isRefresh: true });
  }

  function onRemove(kind, value) {
    Alert.alert(`Remove ${value}?`, "It will be allowed to sign up again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await client.admin.removeBannedEmail({ kind, value });
            const key = kind === "domain" ? "domains" : "emails";
            setData((d) => ({ ...d, [key]: d[key].filter((it) => it.value !== value) }));
          } catch (e) {
            Alert.alert("Couldn't remove", e?.message || "Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingBottom: 96 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />}
    >
      <Text className="font-ui text-sm text-base-content/65 leading-5 mb-5">
        Addresses and whole email domains that can't sign up, change their email to, or be sent an
        invite. Only admins see this.
      </Text>
      {loading ? (
        <View className="py-16 items-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Text className="font-ui text-sm text-error py-6">{error}</Text>
      ) : (
        SECTIONS.map((s) => (
          <Section key={s.kind} section={s} items={data[s.key]} onAdd={onAdd} onRemove={onRemove} />
        ))
      )}
    </ScrollView>
  );
}
