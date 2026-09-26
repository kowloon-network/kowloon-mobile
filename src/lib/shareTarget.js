// Shared by app/index.js (cold-start share, handled from inside the app's
// actual entry screen -- see its own comment for why) and ShareIntentRouter
// (warm share, any screen). Kept in one place so both paths compute the
// exact same target for the exact same share payload.

import { setPendingShare } from "./pendingShare.js";

const URL_RE = /https?:\/\/\S+/i;

// A stable content key so a NEW share is always handled but the SAME one isn't
// re-handled.
export function shareKey(si) {
  if (!si) return "";
  if (si.webUrl) return `url:${si.webUrl}`;
  if (typeof si.text === "string" && si.text) return `text:${si.text}`;
  if (Array.isArray(si.files) && si.files.length)
    return `files:${si.files.map((f) => f.path).join("|")}`;
  return "";
}

// Build the navigation target from a share payload; stashes text/files for the
// composer to consume, returns the route to navigate to (or null).
export function targetFor(shareIntent) {
  const textMatch =
    typeof shareIntent.text === "string" ? shareIntent.text.match(URL_RE) : null;
  const url = shareIntent.webUrl || (textMatch ? textMatch[0] : null);
  // A shared URL goes to the chooser (Link post vs. bookmark).
  if (url) return `/share?url=${encodeURIComponent(url)}`;
  if (Array.isArray(shareIntent.files) && shareIntent.files.length) {
    setPendingShare({
      kind: "files",
      files: shareIntent.files.map((f) => ({
        uri: f.path,
        name: f.fileName,
        mimeType: f.mimeType,
      })),
    });
    return "/compose?fromShare=1";
  }
  if (shareIntent.text) {
    setPendingShare({ kind: "text", text: shareIntent.text });
    return "/compose?fromShare=1";
  }
  return null;
}
