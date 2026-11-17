// Nominatim forward + reverse geocoding helpers.
//
// `searchPlaces(query)` — typed-place autocomplete for the LocationField.
// `reverseLookup({ lat, lon })` — names a GPS fix returned by expo-location.
//
// `baseUrl` defaults to the public OSM Nominatim. The server exposes
// `settings.geocodingUrl` for admin overrides (self-hosted Nominatim or
// Photon); reading it through to the mobile composer is a small future
// TODO — see project_mobile_app_scaffold known-bugs section.

const DEFAULT_BASE = "https://nominatim.openstreetmap.org";

const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
  // Nominatim's usage policy asks for a meaningful User-Agent.
  "User-Agent": "kowloon-mobile/0.9 (https://github.com/kowloon-network/kowloon-mobile)",
};

function stripTrailingSlash(u) {
  return (u || DEFAULT_BASE).replace(/\/$/, "");
}

// Compose the human-readable label the LocationField stores as the place
// name. Mirrors the web's handleSelect logic — primary line + region.
export function placeLabel(result) {
  if (!result) return "";
  const addr = result.address || {};
  const primary =
    result.name ||
    addr.city ||
    addr.town ||
    addr.village ||
    addr.county ||
    result.display_name?.split(",")[0]?.trim();
  const parts = [primary, addr.state, addr.country].filter(Boolean);
  return parts.join(", ");
}

export async function searchPlaces(query, { baseUrl, limit = 5, signal } = {}) {
  if (!query || query.length < 2) return [];
  const url =
    `${stripTrailingSlash(baseUrl)}/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&limit=${limit}&addressdetails=1`;
  const res = await fetch(url, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`Geocoding search ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function reverseLookup({ lat, lon }, { baseUrl, signal } = {}) {
  const url =
    `${stripTrailingSlash(baseUrl)}/reverse` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`Reverse geocoding ${res.status}`);
  return res.json();
}
