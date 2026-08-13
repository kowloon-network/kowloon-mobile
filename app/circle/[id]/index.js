// Circle detail — view a circle, its members, and (for the owner) manage it.
//
// Owner sees Edit / Delete and can remove members inline. Any logged-in user
// can copy the circle (copy-as-new or add its members to one of their own).

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { Newspaper, Pencil, Trash2, X } from "lucide-react-native";

import { Avatar } from "../../../src/components/posts/Avatar.jsx";
import { AppHeader } from "../../../src/components/nav/AppHeader.jsx";
import { Button } from "../../../src/components/ui/Button.jsx";
import { CircleAvatar } from "../../../src/components/circles/CircleAvatar.jsx";
import { CircleHeartButton } from "../../../src/components/circles/CircleHeartButton.jsx";
import { CopyCircleMenu } from "../../../src/components/circles/CopyCircleMenu.jsx";
import { useActiveClient } from "../../../src/lib/useActiveClient.js";
import { circleVisibilityLabel } from "../../../src/lib/circles.js";
import { selectActiveAccount } from "../../../src/state/accountsSlice.js";
import { useInk } from "../../../src/lib/useInk.js";

function memberView(m) {
  return {
    id: m?.id,
    name: m?.name || m?.displayName || m?.id,
    icon: m?.icon || m?.profile?.icon || null,
  };
}

export default function CircleDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const client = useActiveClient();
  const account = useSelector(selectActiveAccount);
  const insets = useSafeAreaInsets();
  const ink = useInk();

  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  // Quick-add state
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const addDebounceRef = useRef(null);

  const load = useCallback(async () => {
    if (!client || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.feeds.getCircle({ circleId: String(id) });
      setCircle(res?.item || res?.circle || res || null);
    } catch (e) {
      setError(e?.message || "Couldn't load this circle.");
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ownerId = circle?.actorId || circle?.actor?.id;
  const isOwner = !!account?.id && ownerId === account.id;
  // System circles (Following, All Following, Groups, Blocked, Muted) are
  // fixed identity, not user content — never deletable, no compose FAB.
  // Name/description/icon editing is locked on the Edit screen itself.
  const isSystem = circle?.type === "System";
  // System-managed circles (Blocked/Muted/Groups) shouldn't get the friendly
  // "find people to add" nudge — it makes no sense on a block list.
  const isSystemManaged =
    isSystem && ["Blocked", "Muted", "Groups"].includes(circle?.name);
  const owner = circle?.actor || (ownerId ? { id: ownerId } : null);
  const members = Array.isArray(circle?.members)
    ? circle.members.map(memberView)
    : [];
  const visibility = circleVisibilityLabel(circle?.to, account?.server);

  // Open a member's profile. A bare "@domain" is a server (one @); a
  // "@user@domain" is a person (two @).
  function openMember(id) {
    if (typeof id !== "string") return;
    const isServer = id.startsWith("@") && !id.slice(1).includes("@");
    router.push(
      isServer
        ? `/server/${encodeURIComponent(id.slice(1))}`
        : `/user/${encodeURIComponent(id)}`
    );
  }

  function confirmDelete() {
    Alert.alert(
      "Delete circle?",
      `"${circle?.name}" will be removed. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ],
      { cancelable: true }
    );
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await client.activities.deleteCircle({ circleId: String(id) });
      router.back();
    } catch (e) {
      setDeleting(false);
      Alert.alert("Couldn't delete", e?.message || "Please try again.");
    }
  }

  // Debounced user search for the quick-add bar.
  useEffect(() => {
    clearTimeout(addDebounceRef.current);
    const q = addQuery.trim();
    if (q.length < 2) {
      setAddResults([]);
      setAddSearching(false);
      return;
    }
    // Don't fire on partial federated handles like @user@incomplete
    const parts = q.replace(/^@/, "").split("@");
    if (parts.length === 2 && !parts[1].includes(".")) return;

    addDebounceRef.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const res = await client.feeds.http.get("/users/search", { params: { q } });
        setAddResults((res?.orderedItems || res?.items || []).map(memberView));
      } catch {
        setAddResults([]);
      } finally {
        setAddSearching(false);
      }
    }, 350);
    return () => clearTimeout(addDebounceRef.current);
  }, [addQuery, client]);

  async function handleAddMember(m) {
    if (addingId) return;
    setAddingId(m.id);
    try {
      await client.activities.addToCircle({ circleId: String(id), members: [m] });
      setCircle((c) =>
        c
          ? {
              ...c,
              members: [...(c.members || []), m],
              memberCount: (c.memberCount || 0) + 1,
            }
          : c
      );
      setAddQuery("");
      setAddResults([]);
    } catch (e) {
      Alert.alert("Couldn't add member", e?.message || "Please try again.");
    } finally {
      setAddingId(null);
    }
  }

  async function removeMember(memberId) {
    if (removingId) return;
    setRemovingId(memberId);
    try {
      await client.activities.removeFromCircle({
        circleId: String(id),
        memberId,
      });
      setCircle((c) =>
        c
          ? {
              ...c,
              members: (c.members || []).filter((m) => m.id !== memberId),
              memberCount: Math.max(0, (c.memberCount || 1) - 1),
            }
          : c
      );
    } catch (e) {
      Alert.alert("Couldn't remove member", e?.message || "Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader back title={circle?.name || "Circle"} />
      <ScrollView contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + (isOwner ? 100 : 40) }}>
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className="py-20 items-center px-6">
            <Text className="font-ui text-base text-error text-center mb-4">
              {error}
            </Text>
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </View>
        ) : circle ? (
          <>
            {/* Header */}
            <View className="px-5 pt-4 pb-5  ">
              <View className="flex-row items-center">
                <CircleAvatar
                  circle={circle}
                  size={60}
                  baseUrl={account?.baseUrl}
                />
                <View className="flex-1 ml-4 min-w-0">
                  <Text className="font-ui text-2xl text-base-content leading-tight">
                    {circle.name}
                  </Text>
                  <Text className="font-ui text-[11px] uppercase tracking-[0.16em] text-base-content/55 mt-1">
                    {visibility}
                    {typeof circle.memberCount === "number"
                      ? ` · ${circle.memberCount} ${
                          circle.memberCount === 1 ? "member" : "members"
                        }`
                      : ""}
                  </Text>
                </View>
              </View>

              {circle.summary ? (
                <Text className="font-ui text-base text-base-content/80 leading-relaxed mt-4">
                  {circle.summary}
                </Text>
              ) : null}

              {/* Owner card — between the header and the action bar */}
              {owner ? (
                <Pressable
                  onPress={() =>
                    owner.id &&
                    router.push(`/user/${encodeURIComponent(owner.id)}`)
                  }
                  android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                  className="flex-row items-center mt-5"
                >
                  <Avatar actor={owner} size={40} baseUrl={account?.baseUrl} />
                  <View className="flex-1 ml-3 min-w-0">
                    <Text className="font-ui uppercase tracking-[0.18em] text-[10px] text-base-content/45 mb-0.5">
                      Owner
                    </Text>
                    <Text
                      className="font-ui text-base text-base-content"
                      numberOfLines={1}
                    >
                      {owner.name || owner.id}
                    </Text>
                    <Text
                      className="font-ui text-xs text-base-content/55"
                      numberOfLines={1}
                    >
                      {owner.id}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {/* Actions */}
              <View
                className="flex-row items-center mt-5 flex-wrap"
                style={{ gap: 10 }}
              >
                <Pressable
                  onPress={() =>
                    router.push(
                      `/feed?view=${encodeURIComponent(String(id))}`
                    )
                  }
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  className="flex-row items-center   px-3 py-2"
                >
                  <Newspaper
                    size={13}
                    color={ink(0.85)}
                    strokeWidth={1.75}
                  />
                  <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content ml-1.5">
                    View Feed
                  </Text>
                </Pressable>
                {isOwner ? (
                  <>
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/circle/${encodeURIComponent(String(id))}/edit`
                        )
                      }
                      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                      className="flex-row items-center   px-3 py-2"
                    >
                      <Pencil
                        size={13}
                        color={ink(0.85)}
                        strokeWidth={1.75}
                      />
                      <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content ml-1.5">
                        Edit
                      </Text>
                    </Pressable>
                    {/* System circles are fixed identity — never deletable. */}
                    {!isSystem ? (
                      <Pressable
                        onPress={confirmDelete}
                        disabled={deleting}
                        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                        className="flex-row items-center   px-3 py-2"
                      >
                        <Trash2 size={13} color="#CC272E" strokeWidth={1.75} />
                        <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-error ml-1.5">
                          {deleting ? "Deleting…" : "Delete"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
                {account?.id ? (
                  <>
                    <CopyCircleMenu circle={circle} />
                    <CircleHeartButton circle={circle} client={client} />
                  </>
                ) : null}
              </View>
            </View>

            {/* Quick-add bar — owner only */}
            {isOwner ? (
              <View className="px-5 pt-4 pb-3  ">
                <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 mb-2">
                  Add Member
                </Text>
                <TextInput
                  value={addQuery}
                  onChangeText={setAddQuery}
                  placeholder="Name, @handle, or @user@other.server"
                  placeholderTextColor={ink(0.35)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="  bg-field px-3 py-2.5 font-ui text-base text-base-content"
                />
                {addSearching ? (
                  <View className="py-3 items-start">
                    <ActivityIndicator />
                  </View>
                ) : addResults.length > 0 ? (
                  <View className="  ">
                    {addResults.map((m) => {
                      const already = members.some((mem) => mem.id === m.id);
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => !already && handleAddMember(m)}
                          disabled={already || addingId === m.id}
                          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                          className="flex-row items-center px-3 py-2.5  "
                        >
                          <Avatar actor={m} size={30} baseUrl={account?.baseUrl} />
                          <View className="flex-1 ml-3 min-w-0">
                            <Text
                              className="font-ui text-sm text-base-content"
                              numberOfLines={1}
                            >
                              {m.name}
                            </Text>
                            <Text
                              className="font-ui text-xs text-base-content/55"
                              numberOfLines={1}
                            >
                              {m.id}
                            </Text>
                          </View>
                          {addingId === m.id ? (
                            <ActivityIndicator size="small" />
                          ) : (
                            <Text className="font-ui uppercase tracking-[0.14em] text-[11px] text-base-content/45 ml-2">
                              {already ? "Added" : "Add"}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Members */}
            <View className="px-5 pt-5">
              <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 mb-3">
                {isOwner || members.length > 0
                  ? `Members${members.length ? ` (${members.length})` : ""}`
                  : "Members"}
              </Text>

              {members.length === 0 ? (
                isOwner && !isSystemManaged ? (
                  <View>
                    <Text className="font-ui text-sm text-base-content/80 leading-6 mb-3">
                      Add people or communities to your Circles to follow them.
                    </Text>
                    <Text className="font-ui text-sm text-base-content/70 leading-6">
                      Looking for people and communities to add? Start with your{" "}
                      <Text
                        className="text-primary font-bold"
                        onPress={() => router.push("/(tabs)/feed?view=all")}
                      >
                        Community Posts
                      </Text>{" "}
                      or{" "}
                      <Text
                        className="text-primary font-bold"
                        onPress={() => router.push("/discover")}
                      >
                        Discover
                      </Text>{" "}
                      new and cool stuff!
                    </Text>
                    <Text className="font-ui text-xs text-base-content/50 leading-5 mt-3">
                      Tip: You can add any Kowloon user or even a community to any
                      of your Circles.
                    </Text>
                  </View>
                ) : (
                  <Text className="font-ui text-sm text-base-content/55 leading-6">
                    {isOwner
                      ? "No members yet."
                      : "This circle's members are private to its owner."}
                  </Text>
                )
              ) : (
                members.map((m) => (
                  <View
                    key={m.id}
                    className="flex-row items-center py-3  "
                  >
                    <Pressable
                      onPress={() => openMember(m.id)}
                      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
                      className="flex-1 flex-row items-center min-w-0"
                    >
                      <Avatar actor={m} size={36} baseUrl={account?.baseUrl} />
                      <View className="flex-1 ml-3 min-w-0">
                        <Text
                          className="font-ui text-sm font-bold text-base-content"
                          numberOfLines={1}
                        >
                          {m.name}
                        </Text>
                        <Text
                          className="font-ui text-xs text-base-content/55"
                          numberOfLines={1}
                        >
                          {m.id}
                        </Text>
                      </View>
                    </Pressable>
                    {isOwner ? (
                      <Pressable
                        onPress={() => removeMember(m.id)}
                        disabled={removingId === m.id}
                        hitSlop={8}
                        android_ripple={{
                          color: "rgba(0,0,0,0.06)",
                          borderless: true,
                        }}
                        className="ml-2 p-1"
                      >
                        {removingId === m.id ? (
                          <ActivityIndicator size="small" />
                        ) : (
                          <X
                            size={18}
                            color={ink(0.45)}
                            strokeWidth={1.75}
                          />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* FAB — only the circle owner can post to their own circle; posting
          "to" a Blocked/Muted circle is meaningless, so skip it for System. */}
      {isOwner && !isSystem ? (
        <Pressable
          onPress={() =>
            router.push(
              `/compose?to=${encodeURIComponent(String(id))}&toName=${encodeURIComponent(circle?.name || "")}`
            )
          }
          style={{ bottom: (insets.bottom || 0) + 32, right: 20 }}
          className="absolute w-14 h-14 bg-primary   items-center justify-center"
          android_ripple={{ color: "rgba(255,255,255,0.15)" }}
        >
          <Text className="text-primary-content text-3xl leading-none mt-[-2px]">
            +
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
