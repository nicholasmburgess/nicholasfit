import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getExercise } from "@/lib/exercises";
import { type DemoVideo, demoFrames, fetchDemoVideo } from "./demos";
import type { Theme } from "./WorkoutScreen";

/**
 * Full-screen "how to" for one exercise. With signal it streams a short ExerciseDB clip; with no
 * signal (or no clip for this exercise) it loops the start/end photos saved on the phone.
 */
export function DemoSheet({ c, exerciseId, onClose }: { c: Theme; exerciseId: string; onClose: () => void }) {
  const ex = getExercise(exerciseId);
  const [video, setVideo] = useState<DemoVideo | null | "loading">("loading");
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetchDemoVideo(exerciseId).then((v) => live && setVideo(v));
    return () => {
      live = false;
    };
  }, [exerciseId]);
  if (!ex) return null;
  const showVideo = video && video !== "loading" && !videoFailed;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible onRequestClose={onClose}>
      <View style={[s.fill, { backgroundColor: c.bg }]}>
        <View style={[s.head, { borderColor: c.line }]}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "800", flex: 1 }} numberOfLines={2}>
            {ex.name}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={[s.done, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.accentInk, fontSize: 17, fontWeight: "700" }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }}>
          {showVideo ? <Clip url={video.url} onError={() => setVideoFailed(true)} /> : <Photos c={c} id={exerciseId} name={ex.name} loading={video === "loading"} />}
          {showVideo && <Text style={{ color: c.muted, fontSize: 12, marginTop: -8 }}>Clip: {video.name} · ExerciseDB</Text>}
          <View style={{ gap: 8 }}>
            {ex.cues.map((cue) => (
              <Text key={cue} style={{ color: c.text, fontSize: 17, lineHeight: 24 }}>
                • {cue}
              </Text>
            ))}
          </View>
          {ex.mistakes.length > 0 && <Text style={{ color: c.muted, fontSize: 15 }}>Avoid: {ex.mistakes.join("; ").toLowerCase()}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Streams the clip on a silent loop. Streamed only, never saved (ExerciseDB's terms). */
function Clip({ url, onError }: { url: string; onError: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status }) => status === "error" && onError());
    return () => sub.remove();
  }, [player, onError]);
  return (
    <View style={s.demo}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
    </View>
  );
}

/** The start/end photos, swapped every second so the movement reads like a short animation. */
function Photos({ c, id, name, loading }: { c: Theme; id: string; name: string; loading: boolean }) {
  const frames = demoFrames(id);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 1100);
    return () => clearInterval(t);
  }, [frames.length]);
  if (frames.length === 0)
    return loading ? <ActivityIndicator style={{ marginVertical: 24 }} /> : <Text style={{ color: c.muted, fontSize: 15 }}>No demo for this one yet. It downloads next time you open a workout with signal.</Text>;
  return (
    <View style={s.demo}>
      {frames.map((src, i) => (
        <Image key={i} source={src} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: frame === i ? 1 : 0 }]} accessibilityLabel={`${name}, ${i === 0 ? "start" : "end"} position`} />
      ))}
      {loading && <ActivityIndicator style={{ position: "absolute", top: 10, right: 10 }} />}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  done: { borderRadius: 12, paddingHorizontal: 18, height: 44, justifyContent: "center" },
  demo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff" },
});
