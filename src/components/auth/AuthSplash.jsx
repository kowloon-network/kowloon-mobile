// Animated day/night city scene for the Welcome screen — same illustrations,
// clouds, occasional plane, and window-flicker as the kowloon.network
// marketing site and the web app's auth screens, ported natively.
//
// No p5.js, no WebView — p5 needs a DOM/Canvas2D that doesn't exist in
// React Native's JS environment, and a WebView would mean shipping a whole
// embedded browser for a decorative element. Instead: react-native-svg for
// the window-flicker overlay (react-native-svg's <Image> can't render an
// SVG href, so the scene backgrounds themselves are pre-rasterized PNGs —
// see assets/splash/) and react-native-reanimated for the clouds/plane
// motion, both already app dependencies.

import { useEffect, useMemo, useState } from "react";
import { Image, useColorScheme, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const nightSceneSrc = require("../../../assets/splash/night-scene.png");
const daySceneSrc = require("../../../assets/splash/day-scene.png");
const planeSrc = require("../../../assets/splash/plane.png");

const SCENES = {
  night: { bg: "#130848" },
  day: { bg: "#ADD8E1" },
};

// Native viewBox the scene illustrations (and the window paths below) were
// authored in — the Svg overlay uses the same box so its coordinates line
// up with the PNG background regardless of the rendered size.
const SCENE_VIEWBOX = "0 0 1024 576";

// d attributes for window1–window8, extracted from the source SVG. Only
// used for the night scene's flicker overlay.
const WINDOW_PATHS = [
  "M308.19,443.94L304.31,459.53L303.92,460.08C303.861,460.165 303.781,460.231 303.69,460.27L287.84,467.34C287.815,467.35 287.789,467.356 287.762,467.356C287.652,467.356 287.562,467.266 287.562,467.156C287.562,467.137 287.565,467.118 287.57,467.1L292.95,450.6C293.046,450.308 293.262,450.073 293.54,449.96L308.19,443.94Z",
  "M490.56,441.74L490.79,449.79C490.763,449.47 490.407,449.697 489.72,450.47L463.92,463.94L464.43,455.88L490.56,441.74Z",
  "M541.26,423.79C541.253,424.397 540.683,424.987 539.55,425.56C528.75,431.067 517.807,436.467 506.72,441.76L506.46,433.5C506.373,433.253 506.563,433.01 507.03,432.77C518.337,426.917 529.527,420.94 540.6,414.84C540.664,414.804 540.736,414.785 540.81,414.785C541.046,414.785 541.24,414.979 541.24,415.215C541.24,415.217 541.24,415.218 541.24,415.22L541.26,423.79Z",
  "M644.22,268.07L650.43,292.58L617.14,319.42L612.56,294.27L644.22,268.07Z",
  "M770.29,242.04L793.59,246.2L798.21,261.75C791.837,260.797 785.6,259.877 779.5,258.99C778.767,258.883 778.313,258.673 778.14,258.36L770.29,242.04Z",
  "M829.19,207.71L837.4,225.44L819.53,223.7L807.74,203.08L829.19,207.71Z",
  "M966.77,222.61L948.34,243.92L941.23,234.24L958.56,212.54C958.547,212.44 958.643,212.407 958.85,212.44C958.977,212.459 959.092,212.527 959.17,212.63L966.77,222.61Z",
  "M865.91,442.63L875.13,464.83C875.241,465.102 875.143,465.415 874.9,465.57L851.06,481.1L841.69,458.56C841.645,458.443 841.687,458.31 841.79,458.24L865.91,442.63Z",
];

const CLOUD_INDICES = Array.from({ length: 14 }, (_, i) => i);

const FLICKER_COLORS = ["#dd308c", "#1b0360"];
const FLICKER_INTERVAL_MS = 3000;

const PLANE_ASPECT = 600 / 522; // matches assets/splash/plane.png
const PLANE_WIDTH_RATIO = 0.14;
const PLANE_MIN_DELAY_MS = 10000;
const PLANE_MAX_DELAY_MS = 30000;
const PLANE_SPEED_PX_PER_SEC_MIN = 16;
const PLANE_SPEED_PX_PER_SEC_MAX = 24;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function pickScene(colorScheme) {
  if (colorScheme === "dark") return "night";
  if (colorScheme === "light") return "day";
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20 ? "day" : "night";
}

function Cloud({ width, height }) {
  const size = useMemo(() => random(width * 0.03, width * 0.2), [width]);
  const startY = useMemo(() => random(0, height * 0.5), [height]);
  const startX = useMemo(() => random(0, width), [width]);
  const speedPxPerSec = useMemo(() => random(3, 12), []);
  const x = useSharedValue(startX);

  useEffect(() => {
    const firstLegDistance = width + size - startX;
    const firstLegDuration = (firstLegDistance / speedPxPerSec) * 1000;
    const fullLoopDuration = ((width + size * 2) / speedPxPerSec) * 1000;

    x.value = withTiming(
      width + size,
      { duration: firstLegDuration, easing: Easing.linear },
      (finished) => {
        if (!finished) return;
        x.value = -size;
        x.value = withRepeat(
          withTiming(width + size, { duration: fullLoopDuration, easing: Easing.linear }),
          -1,
          false
        );
      }
    );

    return () => cancelAnimation(x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value - size / 2,
    top: startY - (size * 0.6) / 2,
    width: size,
    height: size * 0.6,
    borderRadius: 9999,
    backgroundColor: "white",
  }));

  return <Animated.View style={style} />;
}

function Plane({ width, height, active }) {
  const planeW = useMemo(() => width * PLANE_WIDTH_RATIO * random(0.75, 1.25), [width]);
  const planeH = planeW / PLANE_ASPECT;
  const [visible, setVisible] = useState(false);
  const x = useSharedValue(width + planeW);
  const y = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      cancelAnimation(x);
      cancelAnimation(y);
      return;
    }

    let timeoutId;
    function scheduleFlight() {
      timeoutId = setTimeout(launch, random(PLANE_MIN_DELAY_MS, PLANE_MAX_DELAY_MS));
    }

    function launch() {
      const startY = random(height * -0.3, height * 1.3);
      const speed = random(PLANE_SPEED_PX_PER_SEC_MIN, PLANE_SPEED_PX_PER_SEC_MAX);
      // Fixed 45° to the northwest (dx === dy) — the artwork is a
      // perspective illustration already drawn in its one flight attitude,
      // not a silhouette meant to be rotated to face a heading. The flight
      // ends at whichever edge — left or top — it reaches first, which
      // depends on startY: a plane that starts high exits off the top
      // almost immediately; one that starts low sweeps most of the width
      // before climbing out. horizontalBudget is constant; verticalBudget
      // varies with startY — the smaller one is the real flight distance.
      const horizontalBudget = width + 2 * planeW;
      const verticalBudget = startY + planeH;
      // A startY far enough above the top edge (verticalBudget <= 0) means
      // the plane is already past its exit condition before frame one —
      // matches the original canvas loop's behavior of ending the flight
      // on the very first check. Skip animating; just reschedule.
      const distance = Math.min(horizontalBudget, verticalBudget);
      if (distance <= 0) {
        scheduleFlight();
        return;
      }
      const duration = (distance / speed) * 1000;

      x.value = width + planeW;
      y.value = startY;
      setVisible(true);
      x.value = withTiming(width + planeW - distance, { duration, easing: Easing.linear });
      y.value = withTiming(startY - distance, { duration, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
        runOnJS(scheduleFlight)();
      });
    }

    scheduleFlight();
    return () => {
      clearTimeout(timeoutId);
      cancelAnimation(x);
      cancelAnimation(y);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, width, height]);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    width: planeW,
    height: planeH,
    opacity: visible ? 1 : 0,
  }));

  return <Animated.Image source={planeSrc} resizeMode="contain" style={style} />;
}

export function AuthSplash() {
  const colorScheme = useColorScheme();
  // NOT useWindowDimensions() — this component can render inside
  // TabletColumns' narrower center column on wide/tablet layouts, so it
  // needs its own actually-rendered width, not the full device width.
  const [width, setWidth] = useState(0);
  const height = width * (576 / 1024);
  const [scene, setScene] = useState(() => pickScene(colorScheme));
  const [windowColors, setWindowColors] = useState(() => WINDOW_PATHS.map(() => FLICKER_COLORS[0]));

  useEffect(() => {
    setScene(pickScene(colorScheme));
  }, [colorScheme]);

  useEffect(() => {
    if (scene !== "night") return;
    const id = setInterval(() => {
      setWindowColors(WINDOW_PATHS.map(() => FLICKER_COLORS[Math.floor(Math.random() * FLICKER_COLORS.length)]));
    }, FLICKER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [scene]);

  const clouds = CLOUD_INDICES;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: "100%", aspectRatio: 1024 / 576, overflow: "hidden", backgroundColor: SCENES[scene].bg }}
    >
      {width > 0 ? (
        <>
          <Image
            source={scene === "night" ? nightSceneSrc : daySceneSrc}
            resizeMode="cover"
            style={{ position: "absolute", width, height }}
          />

          {scene === "night" ? (
            <Svg
              viewBox={SCENE_VIEWBOX}
              width={width}
              height={height}
              style={{ position: "absolute", width, height }}
              pointerEvents="none"
            >
              {WINDOW_PATHS.map((d, i) => (
                <Path key={i} d={d} fill={windowColors[i]} />
              ))}
            </Svg>
          ) : null}

          {clouds.map((i) => (
            // Keyed by width too — the animation effect below only runs on
            // mount, so a resize (e.g. device rotation) needs a fresh mount
            // to pick up correctly re-scaled geometry rather than
            // continuing to animate toward stale, wrong-sized targets.
            <Cloud key={`${width}-${i}`} width={width} height={height} />
          ))}

          <Plane key={width} width={width} height={height} active={scene === "day"} />
        </>
      ) : null}
    </View>
  );
}
