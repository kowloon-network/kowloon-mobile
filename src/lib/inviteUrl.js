// Parse an invite URL (from a QR code or deep link) into the params the
// Register screen needs.
//
// Accepted shapes:
//
//   kowloon://register?server=kwln.org&inviteCode=abc123
//   https://kwln.org/invite/abc123
//   https://kwln.org/invite/abc123?serverUrl=http://10.0.0.5:3000
//   https://kwln.org/register?inviteCode=abc123
//   kwln.org/invite/abc123        (bare, no scheme — common in pasted text)
//
// Returns `{ server, inviteCode, serverUrl }` or `null` if nothing usable.
// `server` is always a domain (no scheme); `serverUrl` is an optional full
// URL override for local-dev cases where the canonical domain isn't reachable.

import { isValidDomain } from "./identity.js";

// Invite links are attacker-controllable, and the Register screen shows
// `server` while actually talking to `serverUrl` -- so
// ?server=kwln.social&serverUrl=https://evil would display kwln.social but
// register (password included) against evil. Only honour serverUrl when it
// points at the same host as `server` (and is https); dev builds keep the
// LAN-override escape hatch this exists for. Returns "" when not trusted, so
// callers fall back to https://<server>.
export function trustedServerUrl(server, serverUrl) {
  if (!serverUrl) return "";
  if (__DEV__) return serverUrl;
  try {
    const u = new URL(serverUrl);
    const want = String(server || "").trim().toLowerCase();
    if (u.protocol !== "https:" || !want) return "";
    return u.host.toLowerCase() === want || u.hostname.toLowerCase() === want
      ? serverUrl
      : "";
  } catch {
    return "";
  }
}

export function parseInviteUrl(raw) {
  if (!raw) return null;
  let input = String(raw).trim();
  if (!input) return null;

  // Bare-domain shorthand: prepend a protocol so URL can parse it.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) {
    input = `https://${input}`;
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  // Custom scheme: kowloon://register?server=...&inviteCode=...
  if (url.protocol === "kowloon:") {
    const server = url.searchParams.get("server");
    const inviteCode = url.searchParams.get("inviteCode");
    const serverUrl = url.searchParams.get("serverUrl");
    if (!server || !isValidDomain(server)) return null;
    return {
      server,
      inviteCode: inviteCode || "",
      serverUrl: trustedServerUrl(server, serverUrl),
    };
  }

  // HTTP(S) URL: server is the hostname (with port if non-default), invite
  // code is either /invite/<code> or ?inviteCode=<code>.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const port = url.port ? `:${url.port}` : "";
  const server = `${url.hostname}${port}`.toLowerCase();
  if (!isValidDomain(server)) return null;

  let inviteCode = url.searchParams.get("inviteCode") || "";
  if (!inviteCode) {
    const match = url.pathname.match(/^\/invite\/([^/?#]+)/i);
    if (match) inviteCode = decodeURIComponent(match[1]);
  }

  const serverUrl = trustedServerUrl(server, url.searchParams.get("serverUrl"));

  return { server, inviteCode, serverUrl };
}
