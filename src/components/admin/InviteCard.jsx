// One invite: its type, link, note and redemptions, with Copy / Share / QR
// and (when active) Deactivate. Used by the Invites list and by the New
// Invite screen to show the invite it just created.

import { useState } from "react";
import { Alert, Image, Pressable, Share, Text, View } from "react-native";
import { Copy, Share2, QrCode } from "lucide-react-native";

import { useInk } from "../../lib/useInk.js";

// expo-clipboard needs a native module; guard so a stripped build won't crash.
let Clipboard;
try {
  Clipboard = require("expo-clipboard");
} catch {
  Clipboard = { setStringAsync: async () => {} };
}

export function InviteCard({ invite, onDeactivate, initiallyShowQr = false }) {
  const ink = useInk();
  const [showQr, setShowQr] = useState(initiallyShowQr);
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
          <Copy size={12} color={ink(0.7)} strokeWidth={1.75} />
          <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content ml-1.5">Copy</Text>
        </Pressable>
        <Pressable onPress={share} className="flex-row items-center bg-base-200 px-3 py-2" android_ripple={{ color: "rgba(0,0,0,0.08)" }}>
          <Share2 size={12} color={ink(0.7)} strokeWidth={1.75} />
          <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content ml-1.5">Share</Text>
        </Pressable>
        {invite.qrCode ? (
          <Pressable onPress={() => setShowQr((v) => !v)} className="flex-row items-center bg-base-200 px-3 py-2" android_ripple={{ color: "rgba(0,0,0,0.08)" }}>
            <QrCode size={12} color={ink(0.7)} strokeWidth={1.75} />
            <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content ml-1.5">
              {showQr ? "Hide QR" : "QR"}
            </Text>
          </Pressable>
        ) : null}
        {active && onDeactivate ? (
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
