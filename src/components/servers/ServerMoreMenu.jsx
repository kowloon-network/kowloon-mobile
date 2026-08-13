// ServerMoreMenu — kebab menu on a remote Server's profile page: block/mute
// the WHOLE server. Same positional-dropdown pattern as PostMoreMenu.jsx.
//
// Mechanism: a Blocked/Muted circle member can be a bare "@domain" entry
// (one @) as well as an individual "@user@domain" — the same shorthand
// already used for server-level Follow. addToCircle/removeFromCircle handle
// this generically; client.moderation is the cache of the account's own
// blocked/muted actor ids + domains used to show the current state.

import { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, Text } from "react-native";
import { Ban, BellOff, MoreVertical } from "lucide-react-native";
import { useInk } from "../../lib/useInk.js";

const DROPDOWN_WIDTH = 220;
const ICON_SIZE = 15;
const STROKE = 1.75;
const COLOR_DANGER = "#CC272E";

export function ServerMoreMenu({ domain, client, account }) {
  const ink = useInk();
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [state, setState] = useState({ blocked: false, muted: false });

  useEffect(() => {
    if (!client?.moderation || !domain) return;
    let cancelled = false;
    client.moderation.load().then((cache) => {
      if (cancelled) return;
      const d = domain.toLowerCase();
      setState({ blocked: cache.blockedDomains.has(d), muted: cache.mutedDomains.has(d) });
    });
    return () => { cancelled = true; };
  }, [client, domain]);

  if (!account?.id || !domain) return null;

  function openMenu() {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      const left = Math.max(8, x + w - DROPDOWN_WIDTH);
      setDropPos({ top: y + h + 4, left });
      setOpen(true);
    });
  }
  function close() {
    setOpen(false);
  }

  function toggleBlock() {
    close();
    const memberId = `@${domain}`;
    if (state.blocked) {
      Alert.alert(
        "Unblock server?",
        `Unblock ${domain}? Everyone on that server will be able to reach you again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            style: "destructive",
            onPress: async () => {
              try {
                await client.activities.removeFromCircle({ circleId: account.blocked, memberId });
                setState((s) => ({ ...s, blocked: false }));
              } catch (e) {
                Alert.alert("Couldn't unblock", e?.message || "Please try again.");
              }
            },
          },
        ],
        { cancelable: true }
      );
    } else {
      Alert.alert(
        `Block ${domain}?`,
        "Nothing from this server — no posts, replies, or reacts from anyone on it — will reach you again.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              try {
                await client.activities.addToCircle({ circleId: account.blocked, memberId });
                setState((s) => ({ ...s, blocked: true }));
              } catch (e) {
                Alert.alert("Couldn't block", e?.message || "Please try again.");
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  }

  function toggleMute() {
    close();
    const memberId = `@${domain}`;
    if (state.muted) {
      Alert.alert(
        "Unmute server?",
        `Unmute ${domain}? Posts from that server will appear in your feed again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unmute",
            onPress: async () => {
              try {
                await client.activities.removeFromCircle({ circleId: account.muted, memberId });
                setState((s) => ({ ...s, muted: false }));
              } catch (e) {
                Alert.alert("Couldn't unmute", e?.message || "Please try again.");
              }
            },
          },
        ],
        { cancelable: true }
      );
    } else {
      Alert.alert(
        `Mute ${domain}?`,
        "Posts from this server won't appear in your feed. You can undo this any time.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mute",
            style: "destructive",
            onPress: async () => {
              try {
                await client.activities.addToCircle({ circleId: account.muted, memberId });
                setState((s) => ({ ...s, muted: true }));
              } catch (e) {
                Alert.alert("Couldn't mute", e?.message || "Please try again.");
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  }

  const items = [
    {
      key: "block",
      Icon: Ban,
      label: state.blocked ? "Unblock Server" : "Block Server",
      danger: !state.blocked,
      onPress: toggleBlock,
    },
    {
      key: "mute",
      Icon: BellOff,
      label: state.muted ? "Unmute Server" : "Mute Server",
      onPress: toggleMute,
    },
  ];

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        hitSlop={8}
        android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        accessibilityLabel="More options"
      >
        <MoreVertical size={20} color={ink(0.85)} strokeWidth={STROKE} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={close}>
        <Pressable className="flex-1" onPress={close}>
          <Pressable
            onPress={() => {}}
            style={{
              position: "absolute",
              top: dropPos.top,
              left: dropPos.left,
              width: DROPDOWN_WIDTH,
            }}
            className="bg-base-100  "
          >
            {items.map((item) => (
              <Pressable
                key={item.key}
                onPress={item.onPress}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                className="flex-row items-center px-4 py-3"
              >
                <item.Icon
                  size={ICON_SIZE}
                  color={item.danger ? COLOR_DANGER : ink(0.85)}
                  strokeWidth={STROKE}
                />
                <Text
                  className={`font-ui text-sm ml-3 ${item.danger ? "text-error" : "text-base-content"}`}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
