// App entry. Same as expo-router/entry-classic, except the root component is
// wrapped so only one React root can run the app at a time -- see
// src/lib/singleRoot.js (the Android share-sheet bug, #86).
//
// `@expo/metro-runtime` MUST be the first import (Fast Refresh on web).
import "@expo/metro-runtime";

import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

import { withSingleRoot } from "./src/lib/singleRoot.js";

// Only register the root here; no components in this file (Fast Refresh).
renderRootComponent(withSingleRoot(App));
