import { Text } from "react-native";

// Chrome heading — sans, tight tracking, no rounding (headings are platform
// chrome, not reader-controlled content, so font-ui/Inter even above
// reading-serif body text — IDEOLOGY.md §5). Use for title cards and screen
// titles. Size controlled by parent via the `className` prop so this stays
// composable — no size prop, apply the named scale (display/title/heading,
// see kowloon-design/components/Heading.md) at the call site.
export function Heading({ children, className = "", ...props }) {
  return (
    <Text
      className={`font-ui text-base-content ${className}`}
      {...props}
    >
      {children}
    </Text>
  );
}

// Small uppercase eyebrow text — categories, kickers.
export function Eyebrow({ children, className = "", ...props }) {
  return (
    <Text
      className={`font-ui uppercase tracking-[0.25em] text-xs text-base-content/60 ${className}`}
      {...props}
    >
      {children}
    </Text>
  );
}
