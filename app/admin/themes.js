// Admin themes — list all themes, set the server default, create/edit/delete.
// GET /themes is public; create/update/delete/setDefault are admin-only
// (client.themes.* handles both, same client @kowloon/client uses on web).

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Star } from "lucide-react-native";

import { AppHeader, HeaderButton } from "../../src/components/nav/AppHeader.jsx";
import { useActiveClient } from "../../src/lib/useActiveClient.js";
import { useInk } from "../../src/lib/useInk.js";

const SWATCH_KEYS = ["base-100", "primary", "secondary", "accent", "base-content"];

function ThemeSwatches({ theme }) {
  if (!theme.colors) {
    return (
      <View className="w-9 h-9 items-center justify-center border border-base-300">
        <Text className="font-ui text-[9px] text-base-content/40">AUTO</Text>
      </View>
    );
  }
  return (
    <View className="flex-row">
      {SWATCH_KEYS.map((k) => (
        <View
          key={k}
          style={{ backgroundColor: theme.colors[k] || "#888", width: 9, height: 36 }}
        />
      ))}
    </View>
  );
}

export default function AdminThemes() {
  const router = useRouter();
  const client = useActiveClient();
  const ink = useInk();

  const [themes, setThemes] = useState([]);
  const [defaultId, setDefaultId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!client) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await client.themes.list();
        setThemes(res?.themes ?? []);
        setDefaultId(res?.defaultThemeId ?? null);
      } catch (e) {
        setError(
          e?.status === 403 || e?.statusCode === 403
            ? "You don't have admin access on this server."
            : e?.message || "Couldn't load themes."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [client]
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function setDefault(theme) {
    if (busyId) return;
    setBusyId(theme.id);
    try {
      await client.themes.setDefault(theme.id);
      setDefaultId(theme.id);
    } catch (e) {
      Alert.alert("Couldn't set default", e?.message || "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100" edges={["left", "right"]}>
      <AppHeader
        back
        title="Themes"
        right={<HeaderButton label="New" onPress={() => router.push("/admin/theme/new")} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />
        }
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="font-ui text-sm text-error px-5 py-6">{error}</Text>
        ) : themes.length === 0 ? (
          <View className="px-6 py-20 items-center">
            <Text className="font-ui text-base text-base-content/70 text-center">
              No themes yet.
            </Text>
          </View>
        ) : (
          themes.map((theme) => {
            const isDefault = defaultId === theme.id;
            return (
              <Pressable
                key={theme.id}
                onPress={() =>
                  theme.isBuiltIn ? null : router.push(`/admin/theme/${encodeURIComponent(theme.id)}`)
                }
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                className="flex-row items-center px-5 py-3.5 border-b border-base-200"
              >
                <ThemeSwatches theme={theme} />
                <View className="flex-1 min-w-0 ml-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-ui text-base text-base-content" numberOfLines={1}>
                      {theme.name}
                    </Text>
                    {theme.isBuiltIn ? (
                      <View className="bg-base-300 px-1.5 py-0.5">
                        <Text className="font-ui text-[9px] uppercase tracking-[0.1em] text-base-content/50">
                          Built-in
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="font-ui text-xs text-base-content/50 mt-0.5" numberOfLines={1}>
                    {theme.colorScheme}
                    {theme.description ? ` · ${theme.description}` : ""}
                  </Text>
                </View>

                {busyId === theme.id ? (
                  <ActivityIndicator size="small" />
                ) : isDefault ? (
                  <View className="flex-row items-center gap-1 mr-1">
                    <Star size={13} color={ink(0.85)} fill={ink(0.85)} strokeWidth={1.75} />
                    <Text className="font-ui uppercase tracking-[0.12em] text-[10px] text-base-content/70">
                      Default
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setDefault(theme)}
                    hitSlop={8}
                    className="px-3 py-1.5 border border-base-300 mr-1"
                  >
                    <Text className="font-ui uppercase tracking-[0.1em] text-[10px] text-base-content/60">
                      Set Default
                    </Text>
                  </Pressable>
                )}

                {!theme.isBuiltIn ? (
                  <ChevronRight size={16} color={ink(0.3)} strokeWidth={1.75} />
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
