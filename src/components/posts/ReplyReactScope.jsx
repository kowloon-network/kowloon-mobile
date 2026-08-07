// ReplyReactScope — collapsible "who can reply & react" control for the post
// composer/editor. Both fields default to the post's own audience (the parent
// resets them whenever the audience changes); options broader than the audience
// are disabled inside each selector. Collapsed by default so the composer stays
// clean for the many who never touch it.

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";

import { AudienceSelector } from "./AudienceSelector.jsx";
import { useInk } from "../../lib/useInk.js";

export function ReplyReactScope({
  audience,
  canReply,
  canReact,
  onChangeReply,
  onChangeReact,
}) {
  const ink = useInk();
  const [open, setOpen] = useState(false);
  const customized = canReply !== audience || canReact !== audience;

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center px-3 py-2.5"
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      >
        {open ? (
          <ChevronDown size={14} color={ink(0.5)} strokeWidth={1.9} />
        ) : (
          <ChevronRight size={14} color={ink(0.5)} strokeWidth={1.9} />
        )}
        <Text className="font-ui uppercase tracking-[0.12em] text-[11px] text-base-content/50 ml-1.5">
          Advanced
        </Text>
        {customized ? (
          <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-primary ml-2">
            Customized
          </Text>
        ) : null}
      </Pressable>

      {open ? (
        <View className="mt-1">
          <AudienceSelector
            value={canReply}
            onChange={onChangeReply}
            allowPrivate
            constrainTo={audience}
            label="Reply"
            title="Who can reply"
          />
          <AudienceSelector
            value={canReact}
            onChange={onChangeReact}
            allowPrivate
            constrainTo={audience}
            label="React"
            title="Who can react"
          />
        </View>
      ) : null}
    </View>
  );
}
