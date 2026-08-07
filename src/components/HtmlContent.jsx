// Renders server HTML (post body / summary) as native components, styled to
// the editorial theme.
//
// Posts come back with server-rendered HTML in `body`/`summary` (the Markdown
// source isn't included in feed objects), so the app renders HTML rather than
// Markdown.
//
// `fonts` lets reading surfaces (the post detail) pass the user's chosen
// typography fonts; the feed card uses the Inter defaults.

import { useMemo } from "react";
import { Linking, useWindowDimensions } from "react-native";
import { useColorScheme } from "nativewind";
import { router } from "expo-router";
import RenderHtml from "react-native-render-html";

import { fontName } from "../lib/typography.js";
import { openKowloonLink } from "../lib/parseKowloonUrl.js";

// Links to Kowloon objects (posts, circles, groups, users, pages) open in-app;
// everything else goes to the browser. openKowloonLink uses the imported router
// singleton so it works even from surfaces outside the active screen's context.
function handleLinkPress(_event, href) {
  openKowloonLink(href);
}

const RENDERERS_PROPS = { a: { onPress: handleLinkPress } };

const PRIMARY = "#5588B1"; // link / blockquote accent — legible on both themes
// Reading colors swap with the color scheme (#33) so body text stays legible in
// dark mode. ink = body text, muted = blockquote, rule = hr, codeBg = code/pre.
const LIGHT = {
  ink: "#1A1A20",
  muted: "rgba(26,26,32,0.62)",
  rule: "#DDD0B5",
  codeBg: "#EFE6D4",
};
const DARK = {
  ink: "#E9E9EC",
  muted: "rgba(233,233,236,0.62)",
  rule: "rgba(233,233,236,0.18)",
  codeBg: "#2E313A",
};

const DEFAULT_FONTS = {
  regular: fontName("inter", "regular"),
  bold: fontName("inter", "bold"),
  italic: fontName("inter", "italic"),
};

function buildTagStyles(fonts, fontSize, lineHeight, c) {
  return {
    body: { color: c.ink },
    // lineHeight must live on the tag styles — react-native-render-html doesn't
    // reliably cascade baseStyle.lineHeight into paragraph text, so the reading
    // line-spacing preference was being ignored (lines rendered tight).
    p: { marginTop: 0, marginBottom: fontSize * 1.2, lineHeight },
    strong: { fontFamily: fonts.bold },
    b: { fontFamily: fonts.bold },
    em: { fontFamily: fonts.italic },
    i: { fontFamily: fonts.italic },
    u: { textDecorationLine: "underline" },
    s: { textDecorationLine: "line-through" },
    a: { color: PRIMARY, textDecorationLine: "none" },
    h1: {
      fontFamily: fonts.bold,
      fontSize: Math.round(fontSize * 1.6),
      marginTop: fontSize * 0.6,
      marginBottom: fontSize * 0.4,
    },
    h2: {
      fontFamily: fonts.bold,
      fontSize: Math.round(fontSize * 1.35),
      marginTop: fontSize * 0.6,
      marginBottom: fontSize * 0.4,
    },
    h3: {
      fontFamily: fonts.bold,
      fontSize: Math.round(fontSize * 1.15),
      marginTop: fontSize * 0.5,
      marginBottom: fontSize * 0.3,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: PRIMARY,
      paddingLeft: 14,
      marginLeft: 0,
      marginVertical: fontSize * 0.5,
      color: c.muted,
      fontFamily: fonts.italic,
    },
    ul: { marginTop: 0, marginBottom: fontSize * 1.2 },
    ol: { marginTop: 0, marginBottom: fontSize * 1.2 },
    li: { marginBottom: fontSize * 0.2, lineHeight },
    code: {
      fontFamily: "monospace",
      backgroundColor: c.codeBg,
      fontSize: Math.round(fontSize * 0.9),
    },
    pre: {
      fontFamily: "monospace",
      backgroundColor: c.codeBg,
      padding: 12,
      marginVertical: fontSize * 0.5,
      fontSize: Math.round(fontSize * 0.9),
    },
    hr: {
      backgroundColor: c.rule,
      height: 2,
      marginVertical: fontSize * 0.8,
    },
  };
}

export function HtmlContent({
  html,
  fonts = DEFAULT_FONTS,
  fontSize = 15,
  lineHeight,
  color,
  selectable = false,
}) {
  const { width } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const c = colorScheme === "dark" ? DARK : LIGHT;
  const textColor = color ?? c.ink;

  const effectiveLineHeight = lineHeight || Math.round(fontSize * 1.75);

  const baseStyle = useMemo(
    () => ({
      fontFamily: fonts.regular,
      fontSize,
      lineHeight: effectiveLineHeight,
      color: textColor,
    }),
    [fonts.regular, fontSize, effectiveLineHeight, textColor]
  );

  const tagsStyles = useMemo(
    () => buildTagStyles(fonts, fontSize, effectiveLineHeight, c),
    [fonts, fontSize, effectiveLineHeight, c]
  );

  const systemFonts = useMemo(
    () => [fonts.regular, fonts.bold, fonts.italic, "monospace"],
    [fonts]
  );

  if (!html) return null;

  return (
    <RenderHtml
      contentWidth={width}
      source={{ html }}
      baseStyle={baseStyle}
      tagsStyles={tagsStyles}
      systemFonts={systemFonts}
      defaultTextProps={{ selectable }}
      renderersProps={RENDERERS_PROPS}
      enableExperimentalMarginCollapsing
    />
  );
}
