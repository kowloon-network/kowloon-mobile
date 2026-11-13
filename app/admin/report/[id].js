// One moderation report: what was reported, by whom, why, and the four
// things an admin can do about it (blocking a local author is a ban). Mirrors the web's AdminReportPage.

import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EyeOff, Trash2, UserX, Flame, ExternalLink } from "lucide-react-native";

import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { useInk } from "../../../src/lib/useInk.js";
import {
  TYPE_LABELS,
  StatusChip,
  fmtDate,
  personName,
  reasonLabel,
} from "../../../src/components/admin/ReportsList.jsx";
import { banMessage, domainOf, ownDomain } from "../../../src/components/admin/blocklistUtils.js";
import { useStaffRole } from "../../../src/lib/useIsAdmin.js";

// Where the reported thing can be opened in the app.
const VIEW_ROUTE = {
  Post: (id) => `/post/${encodeURIComponent(id)}`,
  Group: (id) => `/group/${encodeURIComponent(id)}`,
  Circle: (id) => `/circle/${encodeURIComponent(id)}`,
  User: (id) => `/user/${encodeURIComponent(id)}`,
};

const DANGER = "#CC272E";

function Field({ label, children }) {
  return (
    <View className="py-3 border-b border-base-200">
      <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/50 mb-1">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Person({ person, id }) {
  const router = useRouter();
  const pid = person?.id || id;
  if (!pid) return <Text className="font-ui text-sm text-base-content/40">--</Text>;
  return (
    <Pressable onPress={() => router.push(`/user/${encodeURIComponent(pid)}`)}>
      <Text className="font-ui text-sm font-bold text-base-content">{personName(person, id)}</Text>
      {person?.name ? (
        <Text numberOfLines={1} className="font-ui text-xs text-base-content/50">
          {pid}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ActionButton({ icon, label, hint, onPress, disabled, danger }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      className={`flex-row items-start px-4 py-3 mb-2 border-2 ${
        danger ? "border-error/40" : "border-base-300"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <View className="mt-0.5 mr-3">{icon}</View>
      <View className="flex-1 min-w-0">
        <Text
          className={`font-ui uppercase tracking-[0.14em] text-[11px] ${
            danger ? "text-error" : "text-base-content"
          }`}
        >
          {label}
        </Text>
        <Text className="font-ui text-xs text-base-content/55 mt-0.5">{hint}</Text>
      </View>
    </Pressable>
  );
}

export default function AdminReport() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const client = useActiveClient();
  const isMod = useStaffRole() === "mod";
  const ink = useInk();

  const [flag, setFlag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    try {
      const res = await client.admin.getFlag({ flagId: String(id) });
      setFlag(res?.flag || null);
      setError(res?.flag ? null : "Report not found.");
    } catch (e) {
      setError(
        e?.status === 404 || e?.statusCode === 404
          ? "Report not found."
          : e?.message || "Couldn't load this report."
      );
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action, doneText) {
    setBusy(true);
    try {
      await action();
      setDone(doneText);
      await load();
    } catch (e) {
      Alert.alert("That didn't work", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmThen(title, message, buttonText, action, doneText) {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: buttonText, style: "destructive", onPress: () => run(action, doneText) },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
        <AppHeader back title="Report" />
        <View className="py-20 items-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!flag) {
    return (
      <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
        <AppHeader back title="Report" />
        <Text className="font-ui text-base text-base-content/70 px-5 py-10">{error}</Text>
      </SafeAreaView>
    );
  }

  const t = flag.targetSummary || {};
  const typeLabel = TYPE_LABELS[flag.targetType] || flag.targetType || "Item";
  const typeLower = typeLabel.toLowerCase();
  const isOpen = flag.status === "open";
  const authorName = personName(flag.targetActor, flag.targetActorId);
  const authorId = flag.targetActor?.id || flag.targetActorId;
  const authorIsLocal = !!authorId && domainOf(authorId) === ownDomain(client);
  const viewRoute = t.exists !== false ? VIEW_ROUTE[flag.targetType]?.(flag.target) : null;
  const images = [
    ...(t.image ? [t.image] : []),
    ...(t.attachments || []).filter((a) => a?.mediaType?.startsWith("image/")).map((a) => a.url),
  ].slice(0, 4);

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title="Report" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 96 }}>
        <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
          <StatusChip status={flag.status} />
          <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/50">
            {typeLabel} -- reported {fmtDate(flag.createdAt)}
          </Text>
        </View>
        <Text className="font-reading text-3xl text-base-content mb-5">{reasonLabel(flag.reason)}</Text>

        {done ? (
          <Text className="font-ui text-sm text-success border-l-4 border-success pl-3 mb-4">{done}</Text>
        ) : null}

        {/* The reported thing */}
        <View className="border-2 border-base-300 p-4 mb-5">
          <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/50 mb-2">
            What was reported{t.removed ? " -- removed" : ""}
          </Text>
          {t.exists === false ? (
            <Text className="font-ui text-sm text-base-content/50">
              This {typeLower} no longer exists.
            </Text>
          ) : (
            <>
              {t.title ? (
                <Text
                  className={`font-reading text-xl mb-1 ${
                    t.removed ? "line-through text-base-content/50" : "text-base-content"
                  }`}
                >
                  {t.title}
                </Text>
              ) : null}
              {t.excerpt && t.excerpt !== t.title ? (
                <Text className="font-ui text-base text-base-content/80 leading-6">{t.excerpt}</Text>
              ) : null}
              {images.length ? (
                <View className="flex-row flex-wrap mt-3" style={{ gap: 4 }}>
                  {images.map((uri) => (
                    <Image
                      key={uri}
                      source={{ uri }}
                      resizeMode="cover"
                      className="bg-base-200"
                      style={{ width: images.length === 1 ? "100%" : "49%", aspectRatio: 1 }}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
          {viewRoute ? (
            <Pressable onPress={() => router.push(viewRoute)} className="flex-row items-center mt-3">
              <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-primary mr-1.5">
                See it in context
              </Text>
              <ExternalLink size={12} color={ink(0.6)} strokeWidth={1.75} />
            </Pressable>
          ) : null}
        </View>

        <View className="mb-6">
          <Field label="Posted by">
            <Person person={flag.targetActor} id={flag.targetActorId} />
          </Field>
          <Field label="Reported by">
            <Person person={flag.reporter} id={flag.actorId} />
          </Field>
          {flag.notes ? (
            <Field label="Reporter's note">
              <Text className="font-ui text-base text-base-content leading-6">{flag.notes}</Text>
            </Field>
          ) : null}
          {!isOpen ? (
            <Field label={flag.status === "dismissed" ? "Dismissed" : "Resolved"}>
              <Text className="font-ui text-sm text-base-content">
                {fmtDate(flag.resolvedAt)}
                {flag.resolver ? ` by ${personName(flag.resolver, flag.resolvedBy)}` : ""}
              </Text>
            </Field>
          ) : null}
        </View>

        {isOpen ? (
          <View>
            <Text className="font-reading text-2xl text-base-content border-b-2 border-base-300 pb-2 mb-3">
              What to do
            </Text>
            <ActionButton
              icon={<EyeOff size={16} color={ink(0.6)} strokeWidth={1.75} />}
              label="Ignore"
              hint="Nothing needs doing. The reporter is told no action was taken."
              disabled={busy}
              onPress={() =>
                run(
                  () => client.admin.ignoreFlag({ flagId: flag.id }),
                  "Report dismissed. The reporter has been told."
                )
              }
            />
            <ActionButton
              icon={<Trash2 size={16} color={ink(0.6)} strokeWidth={1.75} />}
              label="Remove"
              hint="Take it down. The reporter and the author are both told."
              disabled={busy || t.exists === false}
              onPress={() =>
                confirmThen(
                  `Remove this ${typeLower}?`,
                  `${authorName} will be notified.`,
                  "Remove",
                  () => client.admin.removeFlaggedItem({ flagId: flag.id }),
                  "Removed. The reporter and the author have been told."
                )
              }
            />
            {authorIsLocal && isMod ? (
              <Text className="font-ui text-xs text-base-content/55 py-3">
                Banning a member is an admin's call. If this needs a ban, tell an admin -- or remove the {typeLower} now and leave the ban to them.
              </Text>
            ) : authorIsLocal ? (
              <ActionButton
                danger
                icon={<UserX size={16} color={DANGER} strokeWidth={1.75} />}
                label="Ban author"
                hint="Permanently deletes their account and everything they posted."
                disabled={busy || !authorId}
                onPress={() =>
                  confirmThen(
                    `Ban ${authorName}?`,
                    banMessage(authorName),
                    "Ban",
                    () => client.admin.blockFlaggedAuthor({ flagId: flag.id, confirmBan: true }),
                    `${authorName} is banned: their account and posts are deleted, and their email can't sign up again. The reporter has been told.`
                  )
                }
              />
            ) : (
              <ActionButton
                danger
                icon={<UserX size={16} color={DANGER} strokeWidth={1.75} />}
                label="Block creator"
                hint="Refuse everything they send this server. Adds them to the Blocked list."
                disabled={busy || !authorId}
                onPress={() =>
                  confirmThen(
                    `Block ${authorName}?`,
                    "Everything they send this server will be refused. You can remove them from Moderation > Blocked.",
                    "Block",
                    () => client.admin.blockFlaggedAuthor({ flagId: flag.id }),
                    `${authorName} is on the Blocked list. The reporter has been told.`
                  )
                }
              />
            )}
            <ActionButton
              danger
              icon={<Flame size={16} color={DANGER} strokeWidth={1.75} />}
              label="Delete permanently"
              hint="Gone for good, straight away. Can't be undone."
              disabled={busy || t.exists === false}
              onPress={() =>
                confirmThen(
                  `Permanently delete this ${typeLower}?`,
                  "This can't be undone.",
                  "Delete",
                  () => client.admin.hardDeleteFlaggedItem({ flagId: flag.id }),
                  "Deleted permanently."
                )
              }
            />
            {busy ? <ActivityIndicator className="mt-2" /> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
