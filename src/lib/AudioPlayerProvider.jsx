// AudioPlayerProvider — one global audio player + queue (issue #83).
//
// Only one clip plays at a time: every "play audio" request goes through here,
// so tapping a new clip either plays now or queues (prompt when something's
// already playing). Renders a persistent floating bar (title + rw/prev/play/
// next/ff + close) and the play-now/add-to-queue prompt. Consume via
// useAudioBar(): { requestTrack, current, ... }.

import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import { Animated, Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  requestNotificationPermissionsAsync,
} from "expo-audio";
import {
  ChevronRight,
  FastForward,
  Music,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react-native";

const Ctx = createContext(null);
export function useAudioBar() {
  return useContext(Ctx);
}

const SEEK = 15; // seconds for rw/ff

const HANDLE_W = 40;

// Right-edge slide-out player: a small audio tab clings to the right edge; tap
// it and the full player slides out. Auto-expands when a new track loads.
function AudioBar({ api }) {
  const { current, playing, position, duration, queue, index, toggle, prev, next, seekBy, stop } = api;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const panelW = Math.min(340, width - 16);
  // Start minimized to the edge tab — less jarring than popping open.
  const [expanded, setExpanded] = useState(false);
  const tx = useRef(new Animated.Value(panelW - HANDLE_W)).current;

  useEffect(() => {
    Animated.timing(tx, {
      toValue: expanded ? 0 : panelW - HANDLE_W,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [expanded, panelW, tx]);

  if (!current) return null;

  const canPrev = index > 0 || position > 3;
  const canNext = index + 1 < queue.length;
  const top = Math.max(insets.top + 20, height * 0.38);
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <Animated.View
      style={{
        position: "absolute",
        right: 0,
        top,
        width: panelW,
        flexDirection: "row",
        transform: [{ translateX: tx }],
        elevation: 8,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: -2, height: 2 },
      }}
    >
      {/* Handle — the always-visible tab on the right edge. */}
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={{ width: HANDLE_W }}
        className="bg-post-media items-center justify-center"
        android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      >
        {expanded ? (
          <ChevronRight size={20} color="#FAF4E8" strokeWidth={2} />
        ) : (
          <Music size={20} color="#FAF4E8" strokeWidth={1.75} />
        )}
      </Pressable>

      {/* Player */}
      <View className="flex-1 bg-post-media px-3 pt-2 pb-2">
        <View className="flex-row items-center">
          <Text className="font-ui text-xs text-secondary-content flex-1" numberOfLines={1}>
            {current.title || "Audio"}
            {queue.length > 1 ? `  ·  ${index + 1}/${queue.length}` : ""}
          </Text>
          <Pressable onPress={stop} hitSlop={10} className="ml-2">
            <X size={18} color="rgba(255,244,224,0.85)" strokeWidth={2} />
          </Pressable>
        </View>
        <View className="flex-row items-center justify-center mt-1.5" style={{ gap: 18 }}>
          <Pressable onPress={() => seekBy(-SEEK)} hitSlop={8}>
            <Rewind size={18} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
          </Pressable>
          <Pressable onPress={prev} hitSlop={8} disabled={!canPrev}>
            <SkipBack size={20} color={canPrev ? "#FAF4E8" : "rgba(255,244,224,0.35)"} strokeWidth={1.75} />
          </Pressable>
          <Pressable onPress={toggle} hitSlop={10}>
            {playing ? (
              <Pause size={26} color="#FAF4E8" fill="#FAF4E8" strokeWidth={0} />
            ) : (
              <Play size={26} color="#FAF4E8" fill="#FAF4E8" strokeWidth={0} />
            )}
          </Pressable>
          <Pressable onPress={next} hitSlop={8} disabled={!canNext}>
            <SkipForward size={20} color={canNext ? "#FAF4E8" : "rgba(255,244,224,0.35)"} strokeWidth={1.75} />
          </Pressable>
          <Pressable onPress={() => seekBy(SEEK)} hitSlop={8}>
            <FastForward size={18} color="rgba(255,244,224,0.85)" strokeWidth={1.75} />
          </Pressable>
        </View>
        <View className="h-0.5 bg-black/25 mt-2">
          <View className="h-0.5 bg-primary" style={{ width: `${pct}%` }} />
        </View>
      </View>
    </Animated.View>
  );
}

export function AudioPlayerProvider({ children }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  // Queue + index are authoritative in refs (no stale closures in callbacks);
  // a version counter forces re-render for the bar.
  const queueRef = useRef([]);
  const indexRef = useRef(-1);
  const promptRef = useRef(null); // { track } while asking play-now vs queue
  const [, bump] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    // Keep playing when backgrounded / screen locked, with lock-screen controls.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {});
    // Android 13+ needs notification permission for the media notification.
    requestNotificationPermissionsAsync?.().catch(() => {});
  }, []);

  function loadAndPlay(track) {
    try {
      player.replace({ uri: track.url });
      player.play();
      // Lock-screen / notification now-playing + controls (drives the Android
      // foreground service that keeps playback alive in the background).
      player.setActiveForLockScreen?.(true, { title: track.title || "Audio", artist: "Kowloon" });
    } catch {}
  }

  function setState(queue, index) {
    queueRef.current = queue;
    indexRef.current = index;
    bump();
  }

  // Auto-advance to the next queued track when one finishes.
  useEffect(() => {
    if (!status?.didJustFinish) return;
    const q = queueRef.current;
    const i = indexRef.current;
    if (i + 1 < q.length) {
      setState(q, i + 1);
      loadAndPlay(q[i + 1]);
    } else {
      try { player.pause(); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.didJustFinish]);

  const current =
    indexRef.current >= 0 && indexRef.current < queueRef.current.length
      ? queueRef.current[indexRef.current]
      : null;
  const playing = !!status?.playing;
  const position = status?.currentTime || 0;
  const duration = status?.duration || 0;

  // ── Actions ────────────────────────────────────────────────────────────────
  function startFresh(track) {
    setState([track], 0);
    loadAndPlay(track);
  }
  function playNow(track) {
    promptRef.current = null;
    const q = queueRef.current.filter((t) => t.id !== track.id);
    const i = Math.max(indexRef.current, -1);
    const next = [...q.slice(0, i + 1), track, ...q.slice(i + 1)];
    const newIndex = next.findIndex((t) => t.id === track.id);
    setState(next, newIndex);
    loadAndPlay(track);
  }
  function enqueue(track) {
    promptRef.current = null;
    if (indexRef.current < 0) return startFresh(track);
    if (queueRef.current.some((t) => t.id === track.id)) return bump();
    setState([...queueRef.current, track], indexRef.current);
  }
  function requestTrack(track) {
    if (!track?.url) return;
    if (indexRef.current < 0) return startFresh(track);
    if (current?.id === track.id) {
      try { playing ? player.pause() : player.play(); } catch {}
      return;
    }
    promptRef.current = { track };
    bump();
  }
  function toggle() {
    try { playing ? player.pause() : player.play(); } catch {}
  }
  function next() {
    const q = queueRef.current, i = indexRef.current;
    if (i + 1 < q.length) { setState(q, i + 1); loadAndPlay(q[i + 1]); }
  }
  function prev() {
    if (position > 3) return player.seekTo(0).catch(() => {});
    const q = queueRef.current, i = indexRef.current;
    if (i > 0) { setState(q, i - 1); loadAndPlay(q[i - 1]); }
    else player.seekTo(0).catch(() => {});
  }
  function seekBy(delta) {
    const t = Math.max(0, Math.min(duration || 0, position + delta));
    player.seekTo(t).catch(() => {});
  }
  function stop() {
    try {
      player.pause();
      player.clearLockScreenControls?.();
    } catch {}
    setState([], -1);
  }

  const api = {
    requestTrack, playNow, enqueue, toggle, next, prev, seekBy, stop,
    current, playing, position, duration,
    queue: queueRef.current, index: indexRef.current,
  };

  const prompt = promptRef.current;

  return (
    <Ctx.Provider value={api}>
      {children}

      {/* Right-edge slide-out player */}
      <AudioBar api={api} />



      {/* Play now / Add to queue prompt */}
      <Modal visible={!!prompt} transparent animationType="fade" onRequestClose={() => { promptRef.current = null; bump(); }}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => { promptRef.current = null; bump(); }}>
          <Pressable className="bg-base-100 px-5 pt-4 pb-8" onPress={() => {}}>
            <Text className="font-ui text-sm text-base-content/60 mb-1">Something's already playing</Text>
            <Text className="font-ui text-base text-base-content font-bold mb-4" numberOfLines={2}>
              {prompt?.track?.title || "Audio"}
            </Text>
            <Pressable
              onPress={() => prompt && playNow(prompt.track)}
              className="bg-primary py-3 items-center mb-2"
              android_ripple={{ color: "rgba(255,255,255,0.12)" }}
            >
              <Text className="font-ui uppercase tracking-[0.14em] text-xs text-primary-content font-bold">Play now</Text>
            </Pressable>
            <Pressable
              onPress={() => prompt && enqueue(prompt.track)}
              className="bg-base-200 py-3 items-center"
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <Text className="font-ui uppercase tracking-[0.14em] text-xs text-base-content">Add to queue</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}
