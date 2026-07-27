// Parse a Kowloon URL into the object it points at, and route Kowloon links to
// the in-app screen instead of the browser.
//
// Posts / circles / groups / users carry a prefixed, server-qualified ID right
// in the URL path (e.g. /posts/post:abc@domain), so they're self-identifying —
// no domain allowlist needed, works for any server present or future. Pages use
// human slugs (/pages/some-slug), which aren't distinguishable from a non-
// Kowloon site's /pages/ path, so we only treat those as Kowloon when the host
// is a server we know is Kowloon (registerKowloonHost).

import { Linking } from "react-native";
import { router } from "expo-router";

// Known Kowloon server hosts, for disambiguating page URLs. Populated as the app
// learns its own server (and, later, federated servers).
const kowloonHosts = new Set();

export function registerKowloonHost(domain) {
  if (!domain) return;
  const host = String(domain)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/:].*$/, "");
  if (host) kowloonHosts.add(host);
}

function routeFor(type, idOrSlug) {
  const enc = encodeURIComponent(idOrSlug);
  switch (type) {
    case "post":   return `/post/${enc}`;
    case "group":  return `/group/${enc}`;
    case "circle": return `/circle/${enc}`;
    case "user":   return `/user/${enc}`;
    case "page":   return `/pages/${enc}`;
    default:       return null;
  }
}

function make(type, raw) {
  const id = decodeURIComponent(raw);
  return { type, id, route: routeFor(type, id) };
}

export function parseKowloonUrl(href) {
  if (!href) return null;
  let u;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const p = u.pathname;
  let m;

  // Prefixed IDs in the path — self-identifying, any server.
  if ((m = p.match(/^\/posts\/(post:[^/?#]+@[^/?#]+)/)))     return make("post", m[1]);
  if ((m = p.match(/^\/groups\/(group:[^/?#]+@[^/?#]+)/)))   return make("group", m[1]);
  if ((m = p.match(/^\/circles\/(circle:[^/?#]+@[^/?#]+)/))) return make("circle", m[1]);
  if ((m = p.match(/^\/users\/(@[^/?#]+@[^/?#]+)/)))         return make("user", m[1]);

  // Pages use slugs — only Kowloon when we recognize the host.
  if ((m = p.match(/^\/pages\/([^/?#]+)/)) && kowloonHosts.has(u.hostname.toLowerCase())) {
    const slug = decodeURIComponent(m[1]);
    return { type: "page", id: slug, slug, route: routeFor("page", slug) };
  }

  return null;
}

export function kowloonRouteFromUrl(href) {
  return parseKowloonUrl(href)?.route || null;
}

// Open a link the right way: route in-app if it points at a Kowloon object we
// can show, otherwise hand it to the browser. Returns true if handled in-app.
export function openKowloonLink(href) {
  const route = kowloonRouteFromUrl(href);
  if (route) {
    router.push(route);
    return true;
  }
  if (href) Linking.openURL(href).catch(() => {});
  return false;
}

// Back-compat for callers that only wanted the post id.
export function kowloonPostIdFromUrl(href) {
  const parsed = parseKowloonUrl(href);
  return parsed?.type === "post" ? parsed.id : null;
}
