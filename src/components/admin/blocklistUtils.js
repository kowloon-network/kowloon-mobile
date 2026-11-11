// Small helpers shared by the block-list admin views, the report screen and
// the Users screen.

// This server's own domain, from the client's base URL (protocol and path
// stripped).
export function ownDomain(client) {
  const base = client?.admin?.http?.baseUrl || client?.http?.baseUrl || "";
  return base
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
}

// The domain part of an actor id: '@name@domain', '@domain', 'name@domain',
// or an https URL.
export function domainOf(id) {
  if (!id || typeof id !== "string") return "";
  const s = id.trim().toLowerCase();
  if (/^https?:\/\//.test(s)) {
    return s.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  }
  return s.split("@").filter(Boolean).pop() || "";
}

// Mirrors the server's normalizeTarget(): a person ('@name@example.org') or
// a server ('example.org'). Returns null when it can't be read.
export function parseTarget(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^https?:\/\//.test(s)) s = s.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  if (s.startsWith("@")) s = s.slice(1);
  const parts = s.split("@");
  const valid = (d) => /^[a-z0-9.-]+\.[a-z]{2,}$|^localhost(:\d+)?$/.test(d);
  if (parts.length === 1) {
    return valid(parts[0]) ? { kind: "server", id: `@${parts[0]}`, domain: parts[0] } : null;
  }
  if (parts.length === 2 && /^[a-z0-9_.-]+$/.test(parts[0]) && valid(parts[1])) {
    return { kind: "person", id: `@${parts[0]}@${parts[1]}`, domain: parts[1] };
  }
  return null;
}

export function isConflict(e) {
  return e?.statusCode === 409 || e?.status === 409;
}

export function banMessage(name) {
  return `This permanently deletes ${name}'s account and everything they posted. It can't be undone.`;
}
