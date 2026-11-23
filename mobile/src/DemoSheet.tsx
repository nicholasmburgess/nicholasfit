import { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getExercise, videoSearchUrl } from "@/lib/exercises";
import { demoFrames } from "./demos";
import type { Theme } from "./WorkoutScreen";

/** Full-screen "how to" for one exercise: a looping start/end demo, the cues, and a video link. */
export function DemoSheet({ c, exerciseId, onClose }: { c: Theme; exerciseId: string; onClose: () => void }) {
  const ex = getExercise(exerciseId);
  const frames = demoFrames(exerciseId);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), 1100);
    return () => clearInterval(id);
  }, [frames.length]);
  if (!ex) return null;

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
          {frames.length > 0 ? (
            <View style={s.demo}>
              {frames.map((src, i) => (
                <Image key={i} source={src} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: frame === i ? 1 : 0 }]} accessibilityLabel={`${ex.name}, ${i === 0 ? "start" : "end"} position`} />
              ))}
            </View>
          ) : (
            <Text style={{ color: c.muted, fontSize: 15 }}>The demo for this exercise downloads next time you open a workout with signal.</Text>
          )}
          <View style={{ gap: 8 }}>
            {ex.cues.map((cue) => (
              <Text key={cue} style={{ color: c.text, fontSize: 17, lineHeight: 24 }}>
                • {cue}
              </Text>
            ))}
          </View>
          {ex.mistakes.length > 0 && <Text style={{ color: c.muted, fontSize: 15 }}>Avoid: {ex.mistakes.join("; ").toLowerCase()}</Text>}
          <Pressable onPress={() => Linking.openURL(videoSearchUrl(ex)).catch(() => {})} style={[s.video, { borderColor: c.line, backgroundColor: c.card }]}>
            <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>▶ Watch a video on YouTube (needs signal)</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  done: { borderRadius: 12, paddingHorizontal: 18, height: 44, justifyContent: "center" },
  demo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff" },
  video: { height: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
