// Root route -- spinner while accounts hydrate, then redirect:
//   - no accounts  -> /welcome
//   - has accounts -> /feed
//
// Shares into Kowloon are NOT routed from here any more: ShareSheet (mounted
// at the root) shows them as a panel once signed in, and a tap on a
// choice does the navigation. See src/components/ShareSheet.jsx.

import { useSelector } from "react-redux";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";

import {
  selectAccounts,
  selectAccountsStatus,
} from "../src/state/accountsSlice.js";
import { useNavigatorReady } from "../src/lib/navigatorReady.js";

export default function Index() {
  const status = useSelector(selectAccountsStatus);
  const accounts = useSelector(selectAccounts);
  // Don't render <Redirect> until the root navigator reports ready -- an
  // early redirect is an uncatchable "navigate before mounting" crash.
  const navigatorReady = useNavigatorReady();

  if (status === "idle" || status === "loading" || !navigatorReady) {
    return (
      <View className="flex-1 items-center justify-center bg-base-100">
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={accounts.length === 0 ? "/welcome" : "/feed"} />;
}
