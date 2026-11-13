// One server block list -- Blocked (people and servers) or Defederated
// (servers only). Add form, the member list with inline reason editing and
// Remove, and (Blocked only) the Private / Public switch. Used by the
// Moderation screen.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Plus } from "lucide-react-native";

import { useActiveClient } from "../../lib/useActiveClient.js";
import { useInk } from "../../lib/useInk.js";
import { fmtDate } from "./ReportsList.jsx";
import { banMessage, domainOf, isConflict, ownDomain, parseTarget } from "./blocklistUtils.js";
import { useStaffRole } from "../../lib/useIsAdmin.js";

export const inputCls =
  "bg-field border border-base-300 px-3 py-2.5 font-ui text-base text-base-content";

const COPY = {
  blocked: {
    explain:
      "People and servers this server won't deal with. A blocked person's posts, replies and reactions are refused. A blocked server's replies and reactions are refused, but its posts still reach members who follow people there. Adding someone from this server bans them: their account is deleted for good.",
    placeholder: "@name@example.org or example.org",
    empty: "Nobody is blocked.",
  },
  defederated: {
    explain:
      "Servers cut off completely: nothing goes in or out, and they're hidden from search and discovery. A server is only ever on one list -- adding it here takes it off Blocked.",
    placeholder: "example.org",
    empty: "No servers are defederated.",
  },
};

export function Label({ children }) {
  return (
    <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55 mb-1.5">
      {children}
    </Text>
  );
}

export function SmallButton({ label, onPress, disabled, danger, primary }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      className={`px-3 py-2 ${primary ? "bg-primary" : danger ? "" : "bg-base-200"} ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <Text
        className={`font-ui uppercase tracking-[0.12em] text-[10px] ${
          primary ? "text-primary-content" : danger ? "text-error" : "text-base-content"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({ label, danger }) {
  return (
    <Text
      className={`font-ui uppercase tracking-[0.14em] text-[10px] px-2 py-0.5 ${
        danger ? "text-error bg-error/10" : "text-base-content/50 bg-base-200"
      }`}
    >
      {label}
    </Text>
  );
}

function MemberRow({ member, list, domain, editing, onEdit, onCancel, onSave, onRemove, canRemove = true }) {
  const ink = useInk();
  const [draft, setDraft] = useState(member.summary || "");
  const [saving, setSaving] = useState(false);
  const banned = list === "blocked" && member.type === "Person" && domainOf(member.id) === domain;

  useEffect(() => {
    if (editing) setDraft(member.summary || "");
  }, [editing, member.summary]);

  async function save() {
    setSaving(true);
    try {
      await onSave(member, draft.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="border-b border-base-200">
      <Pressable
        onPress={() => (editing ? onCancel() : onEdit(member))}
        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
        className="py-3"
      >
        <Text numberOfLines={1} className="font-ui text-sm font-bold text-base-content">
          {member.name || member.id}
        </Text>
        <Text numberOfLines={1} className="font-ui text-xs text-base-content/55">
          {member.id}
        </Text>
        <View className="flex-row flex-wrap items-center mt-1" style={{ gap: 6 }}>
          {banned ? <Chip label="Banned" danger /> : <Chip label={member.type === "Server" ? "Server" : "Person"} />}
          {member.createdAt ? (
            <Text className="font-ui text-[11px] text-base-content/45">{fmtDate(member.createdAt)}</Text>
          ) : null}
        </View>
        {!editing ? (
          <Text
            className={`font-ui text-xs mt-1 ${member.summary ? "text-base-content/70" : "text-base-content/40"}`}
          >
            {member.summary || "No reason given -- tap to add one."}
          </Text>
        ) : null}
      </Pressable>

      {editing ? (
        <View className="pb-3">
          <Label>Reason</Label>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Why it's on the list"
            placeholderTextColor={ink(0.35)}
            multiline
            className={inputCls}
          />
          <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
            <SmallButton primary label={saving ? "Saving" : "Save"} onPress={save} disabled={saving} />
            <SmallButton label="Cancel" onPress={onCancel} disabled={saving} />
            <View className="flex-1" />
            {canRemove ? (
              <SmallButton danger label="Remove" onPress={() => onRemove(member)} disabled={saving} />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function BlocklistView({ list }) {
  const client = useActiveClient();
  const ink = useInk();
  const copy = COPY[list];
  const domain = ownDomain(client);
  // Moderators can't ban or unban members, or change who sees the list.
  const isMod = useStaffRole() === "mod";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [target, setTarget] = useState("");
  const [summary, setSummary] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [togglingVis, setTogglingVis] = useState(false);

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.admin.getBlocklists();
        setData(res?.[list] || { members: [] });
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load the list."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client, list]
  );

  useEffect(() => {
    setEditingId(null);
    load();
  }, [load]);

  function confirmBan(name, then) {
    Alert.alert(`Ban ${name}?`, banMessage(name), [
      { text: "Cancel", style: "cancel" },
      { text: "Ban", style: "destructive", onPress: then },
    ]);
  }

  async function add(withBan = false) {
    const t = parseTarget(target);
    setAddError(null);
    if (!t) {
      setAddError(
        list === "blocked"
          ? "Enter a server (example.org) or a person (@name@example.org)."
          : "Enter a server, like example.org."
      );
      return;
    }
    if (list === "defederated" && t.kind !== "server") {
      setAddError("Only servers can be defederated. To stop a person, add them to Blocked.");
      return;
    }
    const isLocalPerson = t.kind === "person" && t.domain === domain;
    if (isLocalPerson && isMod) {
      setAddError("Only an admin can ban a member of this server. Report it to an admin, or close their account from Users.");
      return;
    }
    if (isLocalPerson && !withBan) {
      confirmBan(t.id, () => add(true));
      return;
    }
    setAdding(true);
    try {
      await client.admin.addToBlocklist({
        list,
        target: target.trim(),
        summary: summary.trim() || undefined,
        confirmBan: withBan,
      });
      setTarget("");
      setSummary("");
      await load({ isRefresh: true });
    } catch (e) {
      if (isConflict(e) && !withBan && list === "blocked") {
        confirmBan(t.id, () => add(true));
      } else {
        setAddError(e?.message || "Couldn't add that.");
      }
    } finally {
      setAdding(false);
    }
  }

  async function saveSummary(member, text) {
    try {
      const res = await client.admin.updateBlocklistEntry({ list, id: member.id, summary: text });
      const next = res?.summary ?? (text || null);
      setData((d) => ({
        ...d,
        members: (d?.members || []).map((m) => (m.id === member.id ? { ...m, summary: next } : m)),
      }));
      setEditingId(null);
    } catch (e) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    }
  }

  function remove(member) {
    const banned = list === "blocked" && member.type === "Person" && domainOf(member.id) === domain;
    Alert.alert(
      `Remove ${member.name || member.id}?`,
      banned
        ? "They come off the Blocked list. Their deleted account isn't restored."
        : list === "defederated"
        ? "This server will be able to federate with us again."
        : "They'll be able to interact with this server again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await client.admin.removeFromBlocklist({ list, id: member.id });
              setEditingId(null);
              setData((d) => ({ ...d, members: (d?.members || []).filter((m) => m.id !== member.id) }));
            } catch (e) {
              Alert.alert("Couldn't remove", e?.message || "Please try again.");
            }
          },
        },
      ]
    );
  }

  async function setVisibility(isPublic) {
    setTogglingVis(true);
    try {
      const res = await client.admin.setBlocklistVisibility({ list, isPublic });
      setData((d) => ({ ...d, isPublic: res?.isPublic ?? isPublic }));
    } catch (e) {
      Alert.alert("Couldn't change that", e?.message || "Please try again.");
    } finally {
      setTogglingVis(false);
    }
  }

  function onToggleVisibility(next) {
    if (!next) {
      setVisibility(false);
      return;
    }
    Alert.alert(
      "Make the Blocked list public?",
      "The list and its reasons become visible to anyone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Make public", onPress: () => setVisibility(true) },
      ]
    );
  }

  const members = data?.members || [];

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 96 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />}
    >
      <View className="px-5 pt-4">
        <Text className="font-ui text-sm text-base-content/65 leading-5 mb-4">{copy.explain}</Text>

        {/* Add */}
        <View className="border-2 border-base-300 p-4 mb-5">
          <Label>{list === "blocked" ? "Person or server" : "Server"}</Label>
          <TextInput
            value={target}
            onChangeText={setTarget}
            placeholder={copy.placeholder}
            placeholderTextColor={ink(0.35)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            className={`${inputCls} mb-3`}
          />
          <Label>Reason (optional)</Label>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Why it's going on the list"
            placeholderTextColor={ink(0.35)}
            className={`${inputCls} mb-3`}
          />
          {addError ? <Text className="font-ui text-xs text-error mb-3">{addError}</Text> : null}
          <Pressable
            onPress={() => add(false)}
            disabled={adding || !target.trim()}
            android_ripple={{ color: "rgba(0,0,0,0.08)" }}
            className={`flex-row items-center justify-center py-3 bg-primary ${
              adding || !target.trim() ? "opacity-40" : ""
            }`}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#FAF4E8" />
            ) : (
              <>
                <Plus size={14} color="#FAF4E8" strokeWidth={2} />
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content ml-1.5">
                  Add
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="font-ui text-sm text-error py-6">{error}</Text>
        ) : (
          <>
            {list === "blocked" ? (
              <View className="flex-row items-center py-3 mb-2 border-y border-base-200">
                <View className="flex-1 mr-3">
                  <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content">
                    {data?.isPublic ? "Public" : "Private"}
                  </Text>
                  <Text className="font-ui text-xs text-base-content/55 mt-0.5">
                    {data?.isPublic
                      ? "Anyone can see this list and its reasons."
                      : "Only admins and moderators can see this list."}
                  </Text>
                </View>
                {isMod ? null : (
                  <Switch
                    value={!!data?.isPublic}
                    onValueChange={onToggleVisibility}
                    disabled={togglingVis}
                  />
                )}
              </View>
            ) : null}

            <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/50 mt-2 mb-1">
              {members.length} on the list
            </Text>
            {members.length === 0 ? (
              <View className="border-y border-base-200 py-5 items-center">
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/45">
                  {copy.empty}
                </Text>
              </View>
            ) : (
              <View className="border-t border-base-200">
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    list={list}
                    domain={domain}
                    editing={editingId === m.id}
                    onEdit={(mem) => setEditingId(mem.id)}
                    onCancel={() => setEditingId(null)}
                    onSave={saveSummary}
                    onRemove={remove}
                    canRemove={!(isMod && m.type === "Person" && domainOf(m.id) === domain)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
