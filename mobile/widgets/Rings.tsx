import { Chart, HStack, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { TodayProps } from "./Today";

/**
 * The "Nutrition rings" widget (2x2), styled after Apple's own small widgets: the graphic at
 * the top, one big number bottom-left. Calorie ring outside (green, amber when over), protein
 * ring inside (blue). Tracks are a faint shade of each ring's colour and the ends are rounded.
 * A tap opens the app's quick chooser (Log food / Start workout).
 *
 * Self-contained like every widget layout (see Today.tsx); the app sends the same numbers as
 * the Today widget.
 */
const Rings = (p: TodayProps, env: WidgetEnvironment) => {
  "widget";
  const dark = env.colorScheme === "dark";
  const kcalLeft = p.kcalTarget != null ? p.kcalTarget - p.kcal : null;
  const over = kcalLeft != null && kcalLeft < 0;
  const c = dark
    ? { bg: "#000000", muted: "#8e9a93", kcal: over ? "#f0b44c" : "#3cc47f", kcalTrack: over ? "#261d0c" : "#0a1f14", protein: "#5ab0ff", proteinTrack: "#0e1c29" }
    : { bg: "#ffffff", muted: "#6b756f", kcal: over ? "#c27c0e" : "#0b4d34", kcalTrack: over ? "#f5ead8" : "#d8e3df", protein: "#2a7de1", proteinTrack: "#ddeafa" };

  const num = (n: number) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (v: number, t: number | null) => (t ? Math.max(0, Math.min(1, v / t)) : 0);
  const rounded = (size: number, weight: "semibold" | "bold" | "heavy") => font({ size, weight, design: "rounded" });

  // One ring = a faint full-circle track with the progress arc on top (rounded ends).
  const ring = (f: number, color: string, trackColor: string, size: number, thickness: number) => {
    const inner = (size / 2 - thickness) / (size / 2);
    const arc = f >= 0.999 ? [{ x: "a", y: 1, color }] : f <= 0.001 ? [{ x: "b", y: 1, color: "clear" }] : [{ x: "a", y: f, color }, { x: "b", y: 1 - f, color: "clear" }];
    return (
      <ZStack modifiers={[frame({ width: size, height: size })]}>
        <Chart type="pie" data={[{ x: "t", y: 1, color: trackColor }]} pieStyle={{ innerRadius: inner, angularInset: 0, opacity: 1 }} modifiers={[frame({ width: size, height: size })]} />
        <Chart type="pie" data={arc} pieStyle={{ innerRadius: inner, angularInset: 0, cornerRadius: thickness / 2, opacity: 1 }} modifiers={[frame({ width: size, height: size })]} />
      </ZStack>
    );
  };
  const base = [containerBackground(c.bg, "widget"), frame({ maxWidth: 1000, maxHeight: 1000, alignment: "topLeading" })];

  if (!p.ready) {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[...base, widgetURL("nicholasfit://")]}>
        <ZStack>
          {ring(0, c.kcal, c.kcalTrack, 62, 9)}
          {ring(0, c.protein, c.proteinTrack, 41, 9)}
        </ZStack>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(c.muted)]}>Open Nicholasfit once to fill this in</Text>
      </VStack>
    );
  }

  const proteinLeft = p.proteinTarget != null ? p.proteinTarget - p.protein : null;
  const kcalValue = kcalLeft == null ? num(p.kcal) : num(kcalLeft);
  const kcalLabel = kcalLeft == null ? "kcal eaten" : over ? "kcal over" : "kcal left";
  const proteinValue = `${num(proteinLeft == null || proteinLeft <= 0 ? p.protein : proteinLeft)} g`;
  const proteinLabel = proteinLeft == null ? "protein" : proteinLeft <= 0 ? "protein ✓" : "protein left";

  return (
    <VStack alignment="leading" spacing={0} modifiers={[...base, widgetURL("nicholasfit://quick")]}>
      <ZStack>
        {ring(frac(p.kcal, p.kcalTarget), c.kcal, c.kcalTrack, 62, 9)}
        {ring(frac(p.protein, p.proteinTarget), c.protein, c.proteinTrack, 41, 9)}
      </ZStack>
      <Spacer />
      <Text modifiers={[rounded(30, "heavy"), monospacedDigit(), foregroundStyle(c.kcal), lineLimit(1), minimumScaleFactor(0.6)]}>{kcalValue}</Text>
      <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(c.muted), padding({ top: -2 })]}>{kcalLabel}</Text>
      <HStack spacing={4} modifiers={[padding({ top: 6 })]}>
        <Text modifiers={[rounded(15, "bold"), monospacedDigit(), foregroundStyle(c.protein), lineLimit(1)]}>{proteinValue}</Text>
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(c.muted), lineLimit(1), minimumScaleFactor(0.8)]}>{proteinLabel}</Text>
      </HStack>
    </VStack>
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
