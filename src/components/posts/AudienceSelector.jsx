// AudienceSelector — choose who a post is addressed to.
//
// Modeled on the web CircleSelector: Public / Server options plus the user's
// circles. The selected value is the actual `to` string the server expects:
// "@public", "@<domain>", or a circle ID. Single-select; opens as a bottom
// sheet so it works from the bottom of the composer.

import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { useActiveClient } from "../../lib/useActiveClient.js";
import { selectActiveAccount } from "../../state/accountsSlice.js";
import { orderUserCircles } from "../../lib/orderCircles.js";
import { useJoinedGroups } from "../../lib/useJoinedGroups.js";

// `allowPrivate` opts in to a self-only ("Only Me") tier, addressed to the
// user's own ID. Off by default — bookmarks enable it; the post composer does not.
export function AudienceSelector({
  value,
  onChange,
  allowPrivate = false,
  constrainTo = null,
  label = "To",
  title = "Post audience",
}) {
  const account = useSelector(selectActiveAccount);
  const client = useActiveClient();
  const [open, setOpen] = useState(false);
  const [circles, setCircles] = useState([]);
  // Groups the viewer belongs to are always addressable (below circles),
  // mirroring the Feed selector (#67). Same source: the Groups system circle.
  const { groups, refresh: refreshGroups } = useJoinedGroups();

  const serverTo = account?.server ? `@${account.server}` : "@public";
  const selfId = account?.id;

  // When constrainTo is set (the reply/react selectors), disable any option
  // broader than the post's own audience — you can't let people who can't see
  // the post interact with it. "Only Me" (self) is always allowed.
  function optionEnabled(optValue) {
    if (!constrainTo) return true; // the post's own audience selector: no limit
    if (optValue === selfId) return true; // Only Me is the narrowest, always ok
    if (constrainTo === "@public" || constrainTo === "public") return true; // public: anything goes
    // Server / community constraint — matches "@<domain>" (any domain, incl.
    // federated), "@server", or "server". Everything but Public is allowed.
    const isServerConstraint =
      constrainTo === serverTo ||
      constrainTo === "@server" ||
      constrainTo === "server" ||
      (/^@[a-z0-9.-]+$/i.test(constrainTo) && constrainTo !== "@public");
    if (isServerConstraint) return optValue !== "@public";
    if (constrainTo === selfId) return optValue === selfId; // just-me post: only just-me
    return optValue === constrainTo; // constrainTo is a specific circle
  }

  const audienceOptions = useMemo(
    () => [
      {
        value: "@public",
        label: "Public",
        summary: "Anyone, anywhere on the network.",
      },
      {
        value: serverTo,
        label: "Community",
        summary: `Members of ${account?.serverName || account?.server || "this server"}.`,
      },
      ...(allowPrivate && account?.id
        ? [
            {
              value: account.id,
              label: "Only Me",
              summary: "Only you can see this.",
            },
          ]
        : []),
    ],
    [serverTo, account?.serverName, account?.server, allowPrivate, account?.id]
  );

  // Load the user's circles once we have a client.
  useEffect(() => {
    if (!client || !account?.id) return;
    let cancelled = false;
    client.feeds
      .getUserCircles({ userId: account.id })
      .then((res) => {
        const items = res?.orderedItems || res?.items || [];
        if (!cancelled) {
          const pinned = client?.auth?.getUser?.()?.prefs?.pinnedCircles || [];
          setCircles(orderUserCircles(items, account?.id, pinned));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, account?.id]);

  const currentLabel =
    audienceOptions.find((a) => a.value === value)?.label ||
    circles.find((c) => c.id === value)?.name ||
    groups.find((g) => g.id === value)?.name ||
    "Public";

  function select(v) {
    onChange(v);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => {
          refreshGroups?.(); // pick up newly-joined groups on open
          setOpen(true);
        }}
        className="flex-row items-center   px-3 py-2.5"
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      >
        <Text className="font-ui uppercase tracking-[0.12em] text-[11px] text-base-content/50 mr-2">
          {label}
        </Text>
        <Text
          className="font-ui uppercase tracking-[0.12em] text-[11px] text-base-content flex-1"
          numberOfLines={1}
        >
          {currentLabel}
        </Text>
        <Text className="font-ui text-base-content/50 ml-1">▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setOpen(false)}
        >
          {/* Inner Pressable swallows taps so they don't dismiss. */}
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={["bottom"]} className="bg-base-100">
              <View className=" ">
                <Text className="font-ui uppercase tracking-[0.18em] text-[11px] text-base-content/50 px-5 pt-4 pb-2">
                  {title}
                </Text>
                <ScrollView className="max-h-96">
                  {audienceOptions.map((opt) => (
                    <Row
                      key={opt.value}
                      label={opt.label}
                      summary={opt.summary}
                      selected={value === opt.value}
                      disabled={!optionEnabled(opt.value)}
                      onPress={() => select(opt.value)}
                    />
                  ))}

                  {circles.length > 0 ? (
                    <View className="  mt-1 pt-1">
                      <Text className="font-ui uppercase tracking-[0.18em] text-[10px] text-base-content/40 px-5 py-2">
                        Your circles
                      </Text>
                      {circles.map((c) => (
                        <Row
                          key={c.id}
                          label={c.name}
                          summary={c.summary}
                          selected={value === c.id}
                          disabled={!optionEnabled(c.id)}
                          onPress={() => select(c.id)}
                        />
                      ))}
                    </View>
                  ) : null}

                  {groups.length > 0 ? (
                    <View className="  mt-1 pt-1">
                      <Text className="font-ui uppercase tracking-[0.18em] text-[10px] text-base-content/40 px-5 py-2">
                        Your groups
                      </Text>
                      {groups.map((g) => (
                        <Row
                          key={g.id}
                          label={g.name}
                          selected={value === g.id}
                          disabled={!optionEnabled(g.id)}
                          onPress={() => select(g.id)}
                        />
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ label, summary, selected, onPress, disabled = false }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      android_ripple={disabled ? undefined : { color: "rgba(0,0,0,0.05)" }}
      className={`px-5 py-3 ${selected && !disabled ? "bg-secondary" : ""} ${
        disabled ? "opacity-35" : ""
      }`}
    >
      <Text
        className={`font-ui uppercase tracking-[0.14em] text-xs ${
          selected && !disabled ? "text-secondary-content" : "text-base-content"
        }`}
      >
        {label}
      </Text>
      {summary ? (
        <Text
          className={`font-ui text-xs mt-0.5 ${
            selected && !disabled ? "text-secondary-content/70" : "text-base-content/45"
          }`}
        >
          {summary}
        </Text>
      ) : null}
    </Pressable>
  );
}
