// Root route — splash while accounts hydrate, then redirect:
//   - no accounts → /welcome
//   - has accounts, no cold-start share → /feed
//   - has accounts, cold-start share → wherever the share belongs
//
// The cold-start share case is handled HERE, inside the app's actual entry
// screen, deliberately -- not in ShareIntentRouter's global sibling (still
// used for WARM shares, i.e. the app already running on some other screen).
// A share that LAUNCHES the app arrives with hasShareIntent already true on
// the very first render; on Android this raced ahead of Expo Router's own
// navigator readiness when handled from a global sibling of <Stack/> --
// confirmed on-device across five separate readiness-gating attempts (see
// ShareIntentRouter's own comment for the full story). This file's own
// existing <Redirect> for the normal /welcome-vs-/feed boot choice already
// reliably works on every single app launch precisely because it's rendered
// from inside a real, registered screen -- the same guarantee expo-share-
// intent's own official Expo Router example relies on for its equivalent
// redirect. Reusing that exact mechanism for the share case, rather than
// trying to out-guess Expo Router's internal readiness from outside it.

import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useShareIntentContext } from "expo-share-intent";

import {
  selectAccounts,
  selectAccountsStatus,
} from "../src/state/accountsSlice.js";
import { shareKey, targetFor } from "../src/lib/shareTarget.js";
import { setLastConsumedShare } from "../src/lib/shareDedupe.js";

export default function Index() {
  const status = useSelector(selectAccountsStatus);
  const accounts = useSelector(selectAccounts);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const [shareTarget, setShareTarget] = useState(null);
  const handledRef = useRef(false);

  // targetFor() has its own side effects (stashing text/files for the
  // composer via setPendingShare) -- keep it in an effect, not computed
  // directly during render.
  useEffect(() => {
    if (handledRef.current || !hasShareIntent || !shareIntent) return;
    handledRef.current = true;
    let target = null;
    try { target = targetFor(shareIntent); } catch { target = null; }
    if (target) {
      try { setLastConsumedShare(shareKey(shareIntent)); } catch {}
      setShareTarget(target);
    }
    try { resetShareIntent?.(); } catch {}
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  if (status === "idle" || status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-base-100">
        <ActivityIndicator />
      </View>
    );
  }

  if (accounts.length === 0) {
    return <Redirect href="/welcome" />;
  }

  if (shareTarget) {
    return <Redirect href={shareTarget} />;
  }

  return <Redirect href="/feed" />;
}
