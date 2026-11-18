// shareKey(): a stable, hashed key for an inbound share, used by ShareSheet
// to avoid showing the same share twice (Android re-delivers it when the app
// is reopened from recents).

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
