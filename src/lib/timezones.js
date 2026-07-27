// Time-zone helpers for the preferences picker.
//
// Hermes doesn't always ship Intl.supportedValuesOf, so fall back to a curated
// list of common IANA zones. Intl.DateTimeFormat().resolvedOptions().timeZone
// is reliable for detecting the device's zone.

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

const FALLBACK_ZONES = [
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles",
  "America/Denver", "America/Phoenix", "America/Chicago", "America/Mexico_City",
  "America/New_York", "America/Toronto", "America/Bogota", "America/Lima",
  "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "Atlantic/Azores",
  "UTC", "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Paris",
  "Europe/Madrid", "Europe/Berlin", "Europe/Rome", "Europe/Amsterdam",
  "Europe/Brussels", "Europe/Zurich", "Europe/Stockholm", "Europe/Warsaw",
  "Europe/Athens", "Europe/Helsinki", "Europe/Istanbul", "Europe/Moscow",
  "Africa/Casablanca", "Africa/Lagos", "Africa/Johannesburg", "Africa/Nairobi",
  "Africa/Cairo", "Asia/Jerusalem", "Asia/Dubai", "Asia/Karachi",
  "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Jakarta",
  "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Taipei",
  "Asia/Tokyo", "Asia/Seoul", "Australia/Perth", "Australia/Adelaide",
  "Australia/Brisbane", "Australia/Sydney", "Pacific/Auckland", "Pacific/Fiji",
];

export function allTimeZones() {
  try {
    const z = Intl.supportedValuesOf?.("timeZone");
    if (Array.isArray(z) && z.length) return z;
  } catch {
    // fall through
  }
  return FALLBACK_ZONES;
}

// "Europe/London" -> "Europe / London" for display.
export function prettyZone(tz) {
  return (tz || "").replace(/_/g, " ").replace(/\//g, " / ");
}
