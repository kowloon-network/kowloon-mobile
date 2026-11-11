// SortableGroups -- drag-to-reorder for the admin Pages and Bookmarks lists.
// Mirrors the web's components/admin/SortableTableBody.jsx.
//
// Items nest one level (a page under a parent page, a bookmark in a folder)
// and order is stored per sibling group, so each group is its own draggable
// list: the top level first, then one list per parent ("In <Folder>").
// An item can only move within its own group. To move something into a
// different folder/parent, edit it.
//
// Drag starts from the grip handle on the left of each row, so tapping the
// row still opens it and the page still scrolls.
// Uses react-native-draggable-flatlist's Nestable* components, which let
// several draggable lists share one scroll view.

import { RefreshControl, Text, View, Pressable } from "react-native";
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GripVertical } from "lucide-react-native";

import { useInk } from "../../lib/useInk.js";

// Groups in display order: roots (as given -- the server already sorts by
// order, then newest first), then each parent's children. Children whose
// parent isn't in the list count as roots.
function buildGroups(items, parentKey) {
  const ids = new Set(items.map((i) => i.id));
  const parentOf = (i) => (i[parentKey] && ids.has(i[parentKey]) ? i[parentKey] : null);
  const byParent = new Map();
  for (const i of items) {
    const p = parentOf(i);
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(i);
  }
  const roots = byParent.get(null) || [];
  const groups = [{ parent: null, items: roots }];
  for (const r of roots) {
    const kids = byParent.get(r.id);
    if (kids?.length) groups.push({ parent: r, items: kids });
  }
  return groups;
}

export function SortableGroups({
  items,
  parentKey,
  onReorder,            // (siblingIdsInNewOrder) => void
  renderRow,            // (item, { handle, isActive }) => element (no key needed)
  groupLabel = (parent) => `In ${parent.title || "Untitled"}`,
  refreshing = false,
  onRefresh,
  hint,
}) {
  const ink = useInk();
  const groups = buildGroups(items, parentKey);

  return (
    <NestableScrollContainer
      contentContainerStyle={{ paddingBottom: 96 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {hint && items.length > 1 ? (
        <Text className="font-ui text-xs text-base-content/50 px-5 pt-3 pb-1">{hint}</Text>
      ) : null}
      {groups.map((g) => (
        <View key={g.parent?.id || "__root"}>
          {g.parent ? (
            <Text className="font-ui uppercase tracking-[0.16em] text-[10px] text-base-content/45 px-5 pt-5 pb-1.5">
              {groupLabel(g.parent)}
            </Text>
          ) : null}
          <NestableDraggableFlatList
            data={g.items}
            keyExtractor={(item) => item.id}
            activationDistance={8}
            onDragEnd={({ data, from, to }) => {
              if (from !== to) onReorder(data.map((d) => d.id));
            }}
            renderItem={({ item, drag, isActive }) => {
              const handle = (
                <Pressable
                  onPressIn={drag}
                  delayLongPress={0}
                  hitSlop={8}
                  accessibilityLabel="Drag to reorder"
                  className="pr-3 py-2"
                >
                  <GripVertical size={18} color={ink(isActive ? 0.8 : 0.35)} strokeWidth={1.75} />
                </Pressable>
              );
              return (
                <ScaleDecorator activeScale={1.02}>
                  <View className={isActive ? "bg-base-200" : "bg-base-100"}>
                    {renderRow(item, { handle, isActive })}
                  </View>
                </ScaleDecorator>
              );
            }}
          />
        </View>
      ))}
    </NestableScrollContainer>
  );
}

// Apply a reorder locally: give the sibling ids order 0..n-1, then re-sort
// the whole list the way the server does (order ascending, newest first).
export function applyOrder(items, ids) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return items
    .map((it) => (pos.has(it.id) ? { ...it, order: pos.get(it.id) } : it))
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) || new Date(b.createdAt) - new Date(a.createdAt)
    );
}
