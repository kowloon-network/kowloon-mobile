// React hook returning the KowloonClient for the currently-active account,
// or null if no account is active. Components that need to make API calls
// should pull the client through this rather than reach into the client
// module directly — that way switching accounts re-renders consumers.

import { useSelector } from "react-redux";
import { selectActiveAccount } from "../state/accountsSlice.js";
import { ensureClient } from "./client.js";

export function useActiveClient() {
  const account = useSelector(selectActiveAccount);
  if (!account) return null;
  return ensureClient(account);
}
