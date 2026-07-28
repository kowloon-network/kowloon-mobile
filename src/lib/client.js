// Active KowloonClient singletons, keyed by account ID.
//
// Each registered account gets its own KowloonClient instance with its own
// namespaced AsyncStorage adapter. We cache them in-memory so screens don't
// re-instantiate on every render; the cache is cleared when the account is
// removed (sign-out).

import KowloonClient from "@kowloon/client";
import { makeAccountStorage } from "./storage.js";
import { registerKowloonHost } from "./parseKowloonUrl.js";

const clients = new Map();
const serversSynced = new Set(); // account ids we've pulled the known-servers list for

// Learn the network's OTHER known Kowloon servers (from our server's
// FederatedServer cache) so remote page links — whose slugs aren't self-
// identifying — route in-app instead of the browser. Fire-and-forget, once per
// account. /servers is a public discovery endpoint. Grows as the network
// discovers more servers.
async function syncKnownKowloonHosts(client, accountId) {
  if (serversSynced.has(accountId)) return;
  // Mark immediately and NEVER retry from here. ensureClient runs on nearly every
  // render (useActiveClient), so retrying on failure would flood /servers and get
  // rate-limited, starving real requests like the feed. Best-effort, once.
  serversSynced.add(accountId);
  try {
    const res = await client.http.get("/servers");
    const items = res?.orderedItems || res?.items || [];
    for (const s of items) registerKowloonHost(s?.domain || s?.id);
  } catch {
    // best-effort; remote-page recognition just won't include newly-known hosts
    // until next app launch.
  }
}

// Get or create the client for a given account. The account argument must
// have at least `{ id, baseUrl }`.
export function ensureClient(account) {
  if (!account?.id) throw new Error("ensureClient requires account.id");
  // Learn this account's server host so page links (whose slugs aren't self-
  // identifying) route in-app. Cheap + idempotent; runs even for cached clients.
  registerKowloonHost(account.server);
  registerKowloonHost(account.baseUrl);
  let client = clients.get(account.id);
  if (!client) {
    client = new KowloonClient({
      baseUrl: account.baseUrl,
      storage: makeAccountStorage(account.id),
    });
    clients.set(account.id, client);
  }
  // Fire-and-forget; guarded to actually fetch only once on success, and to
  // retry on a later call if the first fired before the token was in storage.
  syncKnownKowloonHosts(client, account.id);
  return client;
}

// Build a one-off client for use BEFORE an account exists in state —
// e.g. during login/register, when we need to hit /auth/login or /register
// to find out who the user is. Uses a temporary in-memory storage so the
// resulting token doesn't leak into the namespaced AsyncStorage of another
// account.
export function makeEphemeralClient(baseUrl) {
  return new KowloonClient({
    baseUrl,
    storage: makeMemoryStorage(),
  });
}

function makeMemoryStorage() {
  const map = new Map();
  return {
    async getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    async setItem(k, v) {
      map.set(k, v);
    },
    async removeItem(k) {
      map.delete(k);
    },
    async clear() {
      map.clear();
    },
  };
}

export async function initClient(account) {
  const client = ensureClient(account);
  await client.init();
  return client;
}

export function forgetClient(accountId) {
  clients.delete(accountId);
}

export function getCachedClient(accountId) {
  return clients.get(accountId) || null;
}
