// orderUserCircles — normalize a raw getUserCircles() result into the list the
// UI should show for circle selection (audience selector, feed selector, etc.).
//
// The user's auto-created Following circle is pinned first (some people only
// ever use Following, so it should always be one tap away). Note it's created
// as type "Circle" (NOT "System") and addressed to the user themselves — that's
// how it stays private yet still appears in this list. So we identify it by its
// self-address (to === the user's own id), falling back to the name, rather
// than by type. `selfId` is the active account's id (e.g. @user@domain).
import { sortByPins } from "@kowloon/client";

export function orderUserCircles(items, selfId, pinnedCircles) {
  const usable = (Array.isArray(items) ? items : []).filter(
    (c) => c?.id && c?.name && c?.type !== "System"
  );
  // Honor the user's explicit pin order first (Following is pinned by default),
  // so every circle list respects the same ordering as the feed selector.
  if (Array.isArray(pinnedCircles) && pinnedCircles.length) {
    return sortByPins(usable, pinnedCircles);
  }
  // Fallback for accounts with no pins yet: Following first.
  const idx = usable.findIndex(
    (c) =>
      (selfId && c.to === selfId) ||
      /^following$/i.test(String(c.name).trim())
  );
  if (idx > 0) {
    const [following] = usable.splice(idx, 1);
    usable.unshift(following);
  }
  return usable;
}
