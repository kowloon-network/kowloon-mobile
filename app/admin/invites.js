// Admin invites — create individual (email) or open (shareable link) invites,
// list them, share/copy the link, show the QR, and deactivate.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Copy, Share2, QrCode, X } from "lucide-react-native";

import { AppHeader, HeaderButton } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";

// expo-clipboard needs a native module; guard so a stripped build won't crash.
let Clipboard;
try {
  Clipboard = require("expo-clipboard");
} catch {
  Clipboard = { setStringAsync: async () => {} };
}

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
  "bg-white border border-base-300 px-3 py-2.5 font-ui text-base text-base-content";

function CreateModal({ visible, client, onClose, onCreated }) {
  const [type, setType] = useState("open"); // open | individual
  const [email, setEmail] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setType("open");
      setEmail("");
      setMaxRedemptions("");
      setNote("");
      setError(null);
    }
  }, [visible]);

  const canSave =
    !saving && (type === "open" || (type === "individual" && email.trim().length > 3));

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
      onCreated?.(res?.invite || res?.created || res);
    } catch (e) {
      setError(e?.message || "Couldn't create the invite.");
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black/40 justify-end">
        <SafeAreaView edges={["bottom"]} className="bg-base-100" style={{ maxHeight: "90%" }}>
          <View className="flex-row items-center justify-between px-5 py-3 bg-secondary">
            <Text className="font-ui text-2xl text-secondary-content">New Invite</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
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
                  placeholderTextColor="rgba(26,26,32,0.35)"
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
                  placeholderTextColor="rgba(26,26,32,0.35)"
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
                placeholderTextColor="rgba(26,26,32,0.35)"
                className={inputCls}
              />
            </Field>

            {error ? <Text className="font-ui text-xs text-error mb-3">{error}</Text> : null}
          </ScrollView>

          <View className="flex-row items-center justify-end px-5 py-3">
            <Pressable onPress={onClose} hitSlop={6} className="px-4 py-2.5 mr-2">
              <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/55">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={!canSave}
              android_ripple={{ color: "rgba(0,0,0,0.08)" }}
              className={`px-5 py-2.5 bg-primary ${canSave ? "" : "opacity-40"}`}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FAF4E8" />
              ) : (
                <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-primary-content">
                  Create
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function InviteCard({ invite, onDeactivate }) {
  const [showQr, setShowQr] = useState(false);
  const url = invite.url || invite.code;
  const active = invite.active !== false && !invite.usedAt;
  const used = invite.redemptionCount ?? (invite.usedAt ? 1 : 0);

  async function copy() {
    await Clipboard.setStringAsync(url || "");
    Alert.alert("Copied", "Invite link copied to the clipboard.");
  }
  async function share() {
    try {
      await Share.share({ message: url });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <View className="px-5 py-4 border-b border-base-200">
      <View className="flex-row items-center mb-1">
        <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45 bg-base-200 px-2 py-0.5">
          {invite.type === "individual" ? "Individual" : "Open link"}
        </Text>
        {!active ? (
          <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-error bg-error/10 px-2 py-0.5 ml-2">
            Inactive
          </Text>
        ) : null}
      </View>

      {invite.email ? (
        <Text className="font-ui text-sm text-base-content" numberOfLines={1}>
          {invite.email}
        </Text>
      ) : null}
      <Text className="font-ui text-[11px] text-base-content/50 mt-0.5" numberOfLines={1}>
        {url}
      </Text>
      {invite.note ? (
        <Text className="font-ui text-xs text-base-content/55 mt-1" numberOfLines={2}>
          {invite.note}
        </Text>
      ) : null}
      <Text className="font-ui text-[11px] text-base-content/45 mt-1">
        {used > 0 ? `${used} redeemed` : "Not yet redeemed"}
        {invite.maxRedemptions ? ` · limit ${invite.maxRedemptions}` : ""}
      </Text>

      {showQr && invite.qrCode ? (
        <View className="items-center py-3">
          <Image source={{ uri: invite.qrCode }} style={{ width: 160, height: 160 }} resizeMode="contain" />
        </View>
      ) : null}

      <View className="flex-row items-center mt-3" style={{ gap: 8 }}>
        <Pressable onPress={copy} className="flex-row items-center bg-base-200 px-3 py-2" android_ripple={{ color: "rgba(0,0,0,0.08)" }}>
          <Copy size={12} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />
          <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content ml-1.5">Copy</Text>
        </Pressable>
        <Pressable onPress={share} className="flex-row items-center bg-base-200 px-3 py-2" android_ripple={{ color: "rgba(0,0,0,0.08)" }}>
          <Share2 size={12} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />
          <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content ml-1.5">Share</Text>
        </Pressable>
        {invite.qrCode ? (
          <Pressable onPress={() => setShowQr((v) => !v)} className="flex-row items-center bg-base-200 px-3 py-2" android_ripple={{ color: "rgba(0,0,0,0.08)" }}>
            <QrCode size={12} color="rgba(26,26,32,0.7)" strokeWidth={1.75} />
            <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content ml-1.5">
              {showQr ? "Hide QR" : "QR"}
            </Text>
          </Pressable>
        ) : null}
        {active ? (
          <Pressable
            onPress={() => onDeactivate(invite)}
            className="flex-row items-center px-3 py-2"
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          >
            <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-error">Deactivate</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function AdminInvites() {
  const client = useActiveClient();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.admin.getInvites({});
        setItems(res?.orderedItems || res?.items || []);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load invites."
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

  function onDeactivate(invite) {
    Alert.alert("Deactivate invite?", "The link will stop working.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          try {
            await client.admin.deleteInvite({ inviteId: invite.id });
            setItems((arr) =>
              arr.map((i) => (i.id === invite.id ? { ...i, active: false } : i))
            );
          } catch (e) {
            Alert.alert("Couldn't deactivate", e?.message || "Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title="Invites"
        right={<HeaderButton label="New" onPress={() => setCreating(true)} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />}
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="font-ui text-sm text-error px-5 py-6">{error}</Text>
        ) : items.length === 0 ? (
          <View className="px-6 py-20 items-center">
            <Text className="font-ui text-base text-base-content/70 text-center mb-1">No invites yet.</Text>
            <Text className="font-ui text-sm text-base-content/45 text-center leading-6">
              Tap New to create an open link or email someone an invite.
            </Text>
          </View>
        ) : (
          items.map((invite) => (
            <InviteCard key={invite.id} invite={invite} onDeactivate={onDeactivate} />
          ))
        )}
      </ScrollView>

      <CreateModal
        visible={creating}
        client={client}
        onClose={() => setCreating(false)}
        onCreated={(invite) => {
          setCreating(false);
          if (invite?.id) setItems((arr) => [invite, ...arr]);
          else load();
        }}
      />
    </SafeAreaView>
  );
}
