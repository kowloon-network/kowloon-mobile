// Register a new Kowloon account.
//
// Flow:
//   Stage 1 — enter server domain (or arrive prefilled via QR scan).
//             Fetch GET / to confirm the server exists, get its name +
//             registrationIsOpen flag + community rules.
//   Stage 2 — server info card unfolds: fill out username, email, password,
//             confirm. If registration is invite-only, the invite code field
//             appears (prefilled from QR if available). Every community rule
//             gets its own checkbox; all must be ticked to submit.
//   Submit  — POST /register via @kowloon/client. If the server enables
//             email verification it returns `{ requiresVerification: true }`;
//             otherwise we get `{ token, user }` and auto-log-in straight to
//             the feed.

import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../src/components/ui/Button.jsx";
import { Field } from "../src/components/ui/Field.jsx";
import { Checkbox } from "../src/components/ui/Checkbox.jsx";
import { Heading, Eyebrow } from "../src/components/ui/Heading.jsx";
import {
  isValidDomain,
  inferBaseUrl,
  domainFromUrl,
} from "../src/lib/identity.js";
import { ensureClient, forgetClient } from "../src/lib/client.js";
import { purgeAccountStorage, rootStorage } from "../src/lib/storage.js";
import { addAccountAndPersist } from "../src/state/accountsSlice.js";
import { TabletColumns } from "../src/components/layout/TabletColumns.jsx";

const BANNER_KEY = "kowloon_discover_welcomed";

export default function Register() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams();

  // Stage 1 — server selection
  const [domain, setDomain] = useState(
    typeof params.server === "string" ? params.server : ""
  );
  const [override, setOverride] = useState(
    typeof params.serverUrl === "string" ? params.serverUrl : ""
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [serverFetching, setServerFetching] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Stage 2 — registration form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState(
    typeof params.inviteCode === "string" ? params.inviteCode : ""
  );
  const [acknowledged, setAcknowledged] = useState({}); // ruleId -> bool

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-fetch server info if we arrived with a prefilled server param.
  useEffect(() => {
    if (typeof params.server === "string" && params.server && !serverInfo) {
      void fetchServerInfo(params.server, override);
    }
    // We only want this to run on mount when params are present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseUrl = useMemo(() => {
    const cleanOverride = override.trim();
    if (cleanOverride) {
      return /^https?:\/\//i.test(cleanOverride)
        ? cleanOverride.replace(/\/$/, "")
        : inferBaseUrl(domainFromUrl(cleanOverride) || cleanOverride);
    }
    return inferBaseUrl(domain.trim());
  }, [domain, override]);

  const rules = serverInfo?.settings?.rules || [];
  const allRulesAcknowledged =
    rules.length === 0 || rules.every((r) => !!acknowledged[r.id]);
  const inviteRequired =
    serverInfo && serverInfo.registrationIsOpen === false;

  async function fetchServerInfo(d, o) {
    const cleanDomain = (d || domain).trim().toLowerCase();
    if (!cleanDomain) {
      setServerError("Enter a server domain.");
      return;
    }
    if (!isValidDomain(cleanDomain)) {
      setServerError("That doesn't look like a valid domain.");
      return;
    }
    const cleanOverride = (o ?? override).trim();
    const url = cleanOverride
      ? /^https?:\/\//i.test(cleanOverride)
        ? cleanOverride.replace(/\/$/, "")
        : inferBaseUrl(domainFromUrl(cleanOverride) || cleanOverride)
      : inferBaseUrl(cleanDomain);

    setServerError(null);
    setServerFetching(true);
    setServerInfo(null);
    setAcknowledged({});
    try {
      // Must ask for JSON explicitly: the server root content-negotiates, and
      // without this header it returns the SPA landing HTML (frontend enabled),
      // which fails to parse ("Unexpected character: <").
      const res = await fetch(`${url}/`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const info = await res.json();
      if (info?.type !== "Service") {
        throw new Error("This doesn't look like a Kowloon server.");
      }
      setServerInfo(info);
    } catch (e) {
      setServerError(
        e?.message?.includes("Network")
          ? `Couldn't reach ${url}.`
          : e?.message || "Couldn't reach that server."
      );
    } finally {
      setServerFetching(false);
    }
  }

  async function handleRegister() {
    setError(null);
    if (!username.trim()) return setError("Choose a username.");
    if (!/^[a-z0-9_-]{2,32}$/i.test(username.trim())) {
      return setError("Username can be letters, numbers, _ and -, 2–32 chars.");
    }
    if (!password) return setError("Pick a password.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (inviteRequired && !inviteCode.trim()) {
      return setError("This server is invite-only — paste your invite code.");
    }
    if (!allRulesAcknowledged) {
      return setError("Tick every rule to continue.");
    }

    const cleanDomain = domain.trim().toLowerCase();
    const accountId = `@${username.trim()}@${cleanDomain}`;

    const provisionalAccount = {
      id: accountId,
      username: username.trim(),
      server: cleanDomain,
      baseUrl,
    };

    setSubmitting(true);
    try {
      const client = ensureClient(provisionalAccount);
      const result = await client.auth.register({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        inviteCode: inviteCode.trim() || undefined,
        acknowledgedRules: rules.map((r) => r.id),
      });

      if (result?.requiresVerification) {
        // Server is holding the account until email verification completes.
        // Tear the (empty) client down and route to a holding screen.
        forgetClient(accountId);
        await purgeAccountStorage(accountId).catch(() => {});
        router.replace({
          pathname: "/verify-email",
          params: { email: email.trim(), server: cleanDomain },
        });
        return;
      }

      if (!result?.token || !result?.user) {
        throw new Error("Server didn't return a session token.");
      }

      const account = {
        ...provisionalAccount,
        profile: result.user.profile || null,
        serverName: serverInfo?.name || undefined,
        addedAt: new Date().toISOString(),
      };

      await dispatch(addAccountAndPersist(account));
      await rootStorage.setItem(BANNER_KEY, "1");
      router.replace("/get-started");
    } catch (e) {
      forgetClient(accountId);
      await purgeAccountStorage(accountId).catch(() => {});
      const msg = e?.response?.data?.error || e?.message || "Registration failed.";
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <TabletColumns sidebar={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-10">
            <Eyebrow>Register</Eyebrow>
            <Heading className="text-4xl mt-2 mb-2 leading-tight">
              Join a server.
            </Heading>
            <Text className="font-ui text-base text-base-content/70 leading-6 mb-6">
              Every Kowloon server is its own community. Pick the one you want
              to join — your account, posts and circles live there.
            </Text>

            <Field
              label="Server domain"
              value={domain}
              onChangeText={setDomain}
              placeholder="kwln.org"
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text
              onPress={() => setShowAdvanced((v) => !v)}
              className="font-ui uppercase tracking-[0.2em] text-[11px] text-base-content/60 mb-3"
            >
              {showAdvanced ? "Hide" : "Use a different server URL"}
            </Text>

            {showAdvanced ? (
              <Field
                label="Server URL"
                value={override}
                onChangeText={setOverride}
                placeholder="http://100.83.23.39:3000"
                hint="For local development or non-default ports."
              />
            ) : null}

            {serverError ? (
              <Text className="font-ui text-sm text-error mt-1 mb-2">
                {serverError}
              </Text>
            ) : null}

            {!serverInfo ? (
              <View className="mt-1">
                <Button
                  label={serverFetching ? "Checking" : "Continue"}
                  onPress={() => fetchServerInfo(domain, override)}
                  loading={serverFetching}
                />
                <Button
                  label="Back"
                  variant="ghost"
                  onPress={() => router.back()}
                  className="mt-3"
                />
              </View>
            ) : (
              <>
                <View className="  bg-base-100 p-4 mt-4 mb-6">
                  <Eyebrow className="mb-1">Server</Eyebrow>
                  <Heading className="text-2xl leading-tight">
                    {serverInfo.name}
                  </Heading>
                  {serverInfo.subtitle ? (
                    <Text className="font-ui text-sm text-base-content/70 mt-1">
                      {serverInfo.subtitle}
                    </Text>
                  ) : null}
                  <Text className="font-ui text-xs text-base-content/50 mt-2">
                    {baseUrl}
                  </Text>
                </View>

                <Field
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="your_handle"
                  autoCapitalize="none"
                  hint="Letters, numbers, underscores and dashes."
                />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="optional"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  hint="Used only for verification and password recovery."
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                />
                <Field
                  label="Confirm password"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  placeholder="••••••••"
                />

                {inviteRequired ? (
                  <Field
                    label="Invite code"
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    autoCapitalize="none"
                    placeholder="paste your invite code"
                    hint="This server is invite-only."
                  />
                ) : null}

                {rules.length > 0 ? (
                  <View className="mt-2 mb-4">
                    <Eyebrow className="mb-2">Community rules</Eyebrow>
                    <Text className="font-ui text-sm text-base-content/70 mb-3 leading-5">
                      Tick every rule to confirm you've read and agreed to it.
                    </Text>
                    <View className="  bg-base-100 px-3 py-1">
                      {rules.map((r) => (
                        <Checkbox
                          key={r.id}
                          checked={!!acknowledged[r.id]}
                          onToggle={() =>
                            setAcknowledged((prev) => ({
                              ...prev,
                              [r.id]: !prev[r.id],
                            }))
                          }
                          label={r.text}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {error ? (
                  <Text className="font-ui text-sm text-error mt-2 mb-2">
                    {error}
                  </Text>
                ) : null}

                <View className="mt-3">
                  <Button
                    label={submitting ? "Creating account" : "Create account"}
                    onPress={handleRegister}
                    loading={submitting}
                    disabled={!allRulesAcknowledged}
                  />
                  <Button
                    label="Pick a different server"
                    variant="ghost"
                    onPress={() => {
                      setServerInfo(null);
                      setAcknowledged({});
                      setError(null);
                    }}
                    className="mt-3"
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </TabletColumns>
    </SafeAreaView>
  );
}
