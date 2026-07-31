// AudioPlayerProvider — one global audio player + queue (issue #83).
//
// Only one clip plays at a time: every "play audio" request goes through here,
// so tapping a new clip either plays now or queues (prompt when something's
// already playing). Renders a persistent floating bar (title + rw/prev/play/
// next/ff + close) and the play-now/add-to-queue prompt. Consume via
// useAudioBar(): { requestTrack, current, ... }.

import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import {
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
const TAB_CLEARANCE = 60; // float above the bottom tab bar

export function AudioPlayerProvider({ children }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const insets = useSafeAreaInsets();

  // Queue + index are authoritative in refs (no stale closures in callbacks);
  // a version counter forces re-render for the bar.
  const queueRef = useRef([]);
  const indexRef = useRef(-1);
  const promptRef = useRef(null); // { track } while asking play-now vs queue
  const [, bump] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  function loadAndPlay(track) {
    try {
      player.replace({ uri: track.url });
      player.play();
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
    try { player.pause(); } catch {}
    setState([], -1);
  }

  const api = {
    requestTrack, playNow, enqueue, toggle, next, prev, seekBy, stop,
    current, playing, position, duration,
    queue: queueRef.current, index: indexRef.current,
  };

  const prompt = promptRef.current;
  const canPrev = indexRef.current > 0 || position > 3;
  const canNext = indexRef.current + 1 < queueRef.current.length;

  return (
    <Ctx.Provider value={api}>
      {children}

      {/* Floating player bar */}
      {current ? (
        <View
          style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + TAB_CLEARANCE }}
          className="bg-secondary px-3 pt-2 pb-2"
        >
          <View className="flex-row items-center">
            <Music size={16} color="rgba(255,244,224,0.9)" strokeWidth={1.75} />
            <Text className="font-ui text-xs text-secondary-content flex-1 ml-2" numberOfLines={1}>
              {current.title || "Audio"}
              {queueRef.current.length > 1 ? `  ·  ${indexRef.current + 1}/${queueRef.current.length}` : ""}
            </Text>
            <Pressable onPress={stop} hitSlop={10} className="ml-2">
              <X size={18} color="rgba(255,244,224,0.85)" strokeWidth={2} />
            </Pressable>
          </View>

          <View className="flex-row items-center justify-center mt-1" style={{ gap: 22 }}>
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

          {/* Progress */}
          <View className="h-0.5 bg-black/25 mt-2">
            <View
              className="h-0.5 bg-primary"
              style={{ width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%` }}
            />
          </View>
        </View>
      ) : null}

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
