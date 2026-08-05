// FeedDefaultsMenu — the "⋮" overflow at the right of the feed toolbar.
//
// Lets the user set the current timeline view and/or the current post-type
// filter as their default, independently. A check marks whichever axis is
// already the default; tapping the other saves it.

import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Check, MoreVertical } from "lucide-react-native";

const DROPDOWN_WIDTH = 248;

export function FeedDefaultsMenu({
  isViewDefault,
  isTypesDefault,
  onSetDefaultView,
  onSetDefaultTypes,
}) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  function openMenu() {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      setPos({ top: y + h + 2, right: 20 });
      setOpen(true);
    });
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        hitSlop={8}
        android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
        className="ml-3"
      >
        <MoreVertical size={22} color="rgba(26,26,32,0.55)" strokeWidth={2} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={{ position: "absolute", top: pos.top, right: pos.right, width: DROPDOWN_WIDTH }}
            className="bg-base-100 border border-base-300"
          >
            <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/40 px-4 pt-3 pb-1">
              Set as default
            </Text>
            <Row
              label="Current view"
              isDefault={isViewDefault}
              onPress={() => onSetDefaultView?.()}
            />
            <Row
              label="Current filters"
              isDefault={isTypesDefault}
              onPress={() => onSetDefaultTypes?.()}
              last
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ label, isDefault, onPress, last }) {
  return (
    <Pressable
      onPress={isDefault ? undefined : onPress}
      disabled={isDefault}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className={`flex-row items-center justify-between px-4 py-3 ${
        last ? "" : " "
      }`}
    >
      <Text
        className={`font-ui text-sm ${
          isDefault ? "text-base-content/45" : "text-base-content"
        }`}
      >
        {label}
      </Text>
      {isDefault ? (
        <View className="flex-row items-center">
          <Check size={14} color="#5588B1" strokeWidth={2.5} />
          <Text className="font-ui uppercase tracking-[0.12em] text-[9px] text-base-content/40 ml-1.5">
            Default
          </Text>
        </View>
      ) : (
        <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-primary">
          Set
        </Text>
      )}
    </Pressable>
  );
}
