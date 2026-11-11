// Moderation reports (Flags) as a tappable list -- used on the admin home
// (open reports) and the Moderation screen. Each row opens the report screen
// (app/admin/report/[id].js). Mirrors the web's components/admin/reports.jsx.
//
// The server enriches each flag with targetSummary {title, excerpt, removed},
// targetActor {id, name} and reporter {id, name}.

import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";

import { useInk } from "../../lib/useInk.js";

export const TYPE_LABELS = {
  Reply: "Reply",
  Post: "Post",
  Page: "Page",
  Bookmark: "Bookmark",
  Group: "Group",
  Circle: "Circle",
  User: "Account",
};

export function reasonLabel(reason, fallback = "Report") {
  if (!reason) return fallback;
  if (typeof reason === "string") return reason;
  return reason.label || reason.description || reason.code || fallback;
}

export function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function targetLabel(flag) {
  const t = flag?.targetSummary;
  if (t?.title) return t.title;
  if (t?.excerpt) return t.excerpt;
  if (t && t.exists === false) return "Item no longer exists";
  return flag?.target || "--";
}

export function personName(person, fallbackId) {
  return person?.name || person?.id || fallbackId || "--";
}

export function StatusChip({ status }) {
  const tone =
    status === "open"
      ? "bg-warning/15 text-warning"
      : status === "resolved"
      ? "bg-success/15 text-success"
      : "bg-base-200 text-base-content/50";
  return (
    <Text className={`font-ui uppercase tracking-[0.14em] text-[10px] px-2 py-0.5 ${tone}`}>
      {status}
    </Text>
  );
}

export function ReportsList({ flags, empty = "No open reports.", showReason = false, showStatus = false }) {
  const router = useRouter();
  const ink = useInk();

  if (!flags?.length) {
    return (
      <View className="border-y border-base-200 py-5 items-center">
        <Text className="font-ui uppercase tracking-[0.16em] text-[11px] text-base-content/45">
          {empty}
        </Text>
      </View>
    );
  }

  return (
    <View className="border-t border-base-200">
      {flags.map((flag) => {
        const removed = !!flag.targetSummary?.removed;
        return (
          <Pressable
            key={flag.id}
            onPress={() => router.push(`/admin/report/${encodeURIComponent(flag.id)}`)}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            className="flex-row items-center py-3 border-b border-base-200"
          >
            <View className="flex-1 min-w-0 mr-2">
              <Text
                numberOfLines={1}
                className={`font-reading text-base ${removed ? "line-through text-base-content/50" : "text-base-content"}`}
              >
                {targetLabel(flag)}
              </Text>
              <View className="flex-row flex-wrap items-center mt-0.5" style={{ gap: 6 }}>
                <Text className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45">
                  {TYPE_LABELS[flag.targetType] || flag.targetType || "Item"}
                  {showReason ? ` -- ${reasonLabel(flag.reason)}` : ""}
                </Text>
                <Text className="font-ui text-[11px] text-base-content/45">{fmtDate(flag.createdAt)}</Text>
                {showStatus ? <StatusChip status={flag.status} /> : null}
              </View>
              <Text numberOfLines={1} className="font-ui text-xs text-base-content/65 mt-1">
                by {personName(flag.targetActor, flag.targetActorId)}
                <Text className="text-base-content/45"> -- reported by </Text>
                {personName(flag.reporter, flag.actorId)}
              </Text>
            </View>
            <ChevronRight size={18} color={ink(0.35)} strokeWidth={1.75} />
          </Pressable>
        );
      })}
    </View>
  );
}
