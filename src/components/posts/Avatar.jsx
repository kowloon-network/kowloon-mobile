import { useState } from "react";
import { Text, View } from "react-native";
import { SmartImage } from "../ui/SmartImage.jsx";

// Circular user avatar — person = circle is universal convention.
// Falls back to a filled initial block (primary fill, matches web's
// UserAvatar -- reconciled per kowloon-design/components/Avatar.md, was
// secondary here) when no icon is set or the image fails.
// `baseUrl` resolves server-relative icon paths; absolute URLs are used as-is.
export function Avatar({ actor, size = 38, baseUrl }) {
  const [failed, setFailed] = useState(false);
  const rawIcon = actor?.icon;
  const icon =
    rawIcon && !/^(https?|file):\/\//i.test(rawIcon) && baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/${rawIcon.replace(/^\//, "")}`
      : rawIcon;
  const name = actor?.name || actor?.id || "?";
  const initial = String(name).replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const radius = size / 2;

  if (icon && !failed) {
    // Use expo-image (via SmartImage), not RN <Image>: the app's /files URLs
    // carry an unencoded ":" and "@" in the path (file:<id>@<domain>), which RN's
    // native Android loader rejects — so avatars fell back to initials on nearly
    // every post while post images (already on expo-image) loaded fine (#61).
    return (
      <SmartImage
        source={{ uri: icon }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: radius }}
        className="  bg-base-200"
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size, borderRadius: radius }}
      className="  bg-primary items-center justify-center"
    >
      <Text
        className="font-ui text-primary-content"
        style={{ fontSize: Math.round(size * 0.42) }}
      >
        {initial}
      </Text>
    </View>
  );
}
