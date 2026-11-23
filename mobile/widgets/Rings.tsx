import { Chart, HStack, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { TodayProps } from "./Today";

/**
 * The "Nutrition rings" widget (2x2): calorie ring outside, protein ring inside. A tap opens
 * the app's quick chooser (Log food / Start workout). Self-contained like every widget layout
 * (see Today.tsx); the app sends it the same numbers as the Today widget.
 */
const Rings = (p: TodayProps, env: WidgetEnvironment) => {
  "widget";
  const dark = env.colorScheme === "dark";
  const green = dark ? "#3cc47f" : "#0b4d34";
  const protein = dark ? "#7fd4ff" : "#2878b5";
  const amber = dark ? "#f0b44c" : "#b7791f";
  const ink = dark ? "#eef2ec" : "#101814";
  const muted = dark ? "#8f9b93" : "#66706b";
  const track = dark ? "#24302a" : "#e6ebe8";
  const bg = dark ? "#0a0f0c" : "#ffffff";

  const num = (n: number) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (v: number, t: number | null) => (t ? Math.max(0, Math.min(1, v / t)) : 0);
  const kcalLeft = p.kcalTarget != null ? p.kcalTarget - p.kcal : null;
  const proteinLeft = p.proteinTarget != null ? p.proteinTarget - p.protein : null;
  const kcalOver = kcalLeft != null && kcalLeft < 0;

  // A ring is a donut chart: the done part in colour, the rest in a faint track.
  const ring = (f: number, color: string, size: number, inner: number) => (
    <Chart
      type="pie"
      data={f >= 0.999 ? [{ x: "done", y: 1, color }] : [{ x: "done", y: Math.max(f, 0.0001), color }, { x: "left", y: 1 - f, color: track }]}
      pieStyle={{ innerRadius: inner, angularInset: 0, opacity: 1 }}
      modifiers={[frame({ width: size, height: size })]}
    />
  );
  const rings = (size: number) => (
    <ZStack modifiers={[frame({ width: size, height: size })]}>
      {ring(frac(p.kcal, p.kcalTarget), kcalOver ? amber : green, size, 0.76)}
      {ring(frac(p.protein, p.proteinTarget), protein, size * 0.66, 0.66)}
    </ZStack>
  );
  const stat = (value: string, label: string, color: string, size: number) => (
    <VStack alignment="leading" spacing={0}>
      <Text modifiers={[font({ size, weight: "bold", design: "rounded" }), monospacedDigit(), foregroundStyle(color), lineLimit(1), minimumScaleFactor(0.6)]}>{value}</Text>
      <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(muted), lineLimit(1), minimumScaleFactor(0.8)]}>{label}</Text>
    </VStack>
  );
  const kcalStat = (size: number) =>
    stat(kcalLeft == null ? num(p.kcal) : num(kcalLeft), kcalLeft == null ? "kcal eaten" : kcalOver ? "kcal over" : "kcal left", kcalOver ? amber : green, size);
  const proteinStat = (size: number) =>
    proteinLeft == null || proteinLeft <= 0
      ? stat(`${num(p.protein)} g`, proteinLeft == null ? "protein" : "protein ✓", protein, size)
      : stat(`${num(proteinLeft)} g`, "protein left", protein, size);
  const background_ = containerBackground(bg, "widget");

  if (!p.ready) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[background_, widgetURL("nicholasfit://"), frame({ maxWidth: 1000, maxHeight: 1000, alignment: "topLeading" })]}>
        <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(green)]}>NICHOLASFIT</Text>
        <Spacer />
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(ink)]}>Open the app once to fill this in.</Text>
      </VStack>
    );
  }

  // The whole widget opens a quick chooser in the app: Log food or Start workout.
  // (iOS makes a small widget a single tap target, so the buttons live in the app.)
  return (
    <HStack spacing={10} modifiers={[background_, widgetURL("nicholasfit://quick")]}>
      {rings(76)}
      <VStack alignment="leading" spacing={8}>
        {kcalStat(19)}
        {proteinStat(15)}
      </VStack>
      <Spacer />
    </HStack>
  );
};

export default createWidget<TodayProps>("Rings", Rings, {
  workout: null,
  trainedToday: false,
  sessions: 0,
  sessionGoal: 3,
  kcal: 0,
  kcalTarget: null,
  protein: 0,
  proteinTarget: null,
  weight: null,
  weightChange: null,
  ready: false,
});
