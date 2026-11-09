// Shared by app/index.js (cold-start share, handled from inside the app's
// actual entry screen -- see its own comment for why) and ShareIntentRouter
// (warm share, any screen). Kept in one place so both paths compute the
// exact same target for the exact same share payload.

import { setPendingShare } from "./pendingShare.js";

const URL_RE = /https?:\/\/\S+/i;

// cyrb53: fast non-cryptographic 53-bit string hash. The key is persisted
// (shareDedupe.js) outside per-account storage, so we store only a hash of the
// shared content, never the shared text/URL itself. Dedupe only needs
// equality; a collision would at worst drop one share as a "replay".
function hashString(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// A stable content key so a NEW share is always handled but the SAME one isn't
// re-handled. Hashed -- see hashString().
export function shareKey(si) {
  if (!si) return "";
  let raw = "";
  if (si.webUrl) raw = `url:${si.webUrl}`;
  else if (typeof si.text === "string" && si.text) raw = `text:${si.text}`;
  else if (Array.isArray(si.files) && si.files.length)
    raw = `files:${si.files.map((f) => f.path).join("|")}`;
  return raw ? `h:${hashString(raw)}` : "";
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
