import { Gauge, HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, frame, gaugeStyle, lineLimit, minimumScaleFactor, monospacedDigit, padding, tint, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

/**
 * The "Today" widget: next workout, calories left, protein and weight trend.
 * Home Screen (small, medium) and Lock Screen (circle, rectangle, inline).
 *
 * The widget runs on its own, away from the app's code: everything it uses is defined inside
 * the function (no outside constants or helpers). The app sends fresh numbers with
 * TodayWidget.updateTimeline() whenever it opens or closes (see src/widgetData.ts).
 */
/**
 * Props are stored in iOS settings, which can't hold null: leave a value out instead
 * (optional fields below), never set it to null.
 */
export type TodayProps = {
  /** Next routine to do, e.g. "Workout A". */
  workout?: string;
  /** A workout was finished today. */
  trainedToday: boolean;
  sessions: number;
  sessionGoal: number;
  kcal: number;
  kcalTarget?: number;
  protein: number;
  proteinTarget?: number;
  weight?: number;
  /** Change over the last 7 days, kg (negative is down). */
  weightChange?: number;
  /** False until the app has sent real numbers. */
  ready: boolean;
};

const Today = (p: TodayProps, env: WidgetEnvironment) => {
  "widget";
  const dark = env.colorScheme === "dark";
  const green = dark ? "#3cc47f" : "#0b4d34";
  const ink = dark ? "#eef2ec" : "#101814";
  const muted = dark ? "#8f9b93" : "#66706b";
  const bg = dark ? "#000000" : "#ffffff";
  const amber = dark ? "#f0b44c" : "#b7791f";
  const family = env.widgetFamily ?? "systemSmall";

  const num = (n: number) => {
    const s = String(Math.round(Math.abs(n)));
    return (n < 0 ? "-" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  const left = p.kcalTarget != null ? p.kcalTarget - p.kcal : null;
  const over = left != null && left < 0;
  const kcalBig = left == null ? num(p.kcal) : num(Math.abs(left));
  const kcalSmall = left == null ? "kcal eaten" : over ? "kcal over" : "kcal left";
  const kcalFrac = p.kcalTarget ? Math.min(1, p.kcal / p.kcalTarget) : 0;
  const protein = p.proteinTarget ? `${num(p.protein)} / ${num(p.proteinTarget)} g` : `${num(p.protein)} g`;
  const workoutLine = p.trainedToday ? "Trained today" : p.workout ? p.workout : "Rest day";
  const weightLine =
    p.weight == null
      ? "No weigh-in"
      : `${p.weight.toFixed(1)} kg` + (p.weightChange == null || Math.abs(p.weightChange) < 0.05 ? "" : ` ${p.weightChange < 0 ? "↓" : "↑"}${Math.abs(p.weightChange).toFixed(1)}`);
  const url = widgetURL("nicholasfit://");

  // Lock Screen widgets are drawn by iOS in one tint, so they use shapes and text only.
  if (family === "accessoryInline") {
    return <Text modifiers={[url]}>{p.ready ? `${p.trainedToday ? "Trained" : (p.workout ?? "Rest")} · ${kcalBig} ${kcalSmall}` : "Open Nicholasfit"}</Text>;
  }
  if (family === "accessoryCircular") {
    return (
      <Gauge value={kcalFrac} modifiers={[gaugeStyle("circularCapacity"), url]} currentValueLabel={<Text modifiers={[font({ size: 13, weight: "semibold" }), monospacedDigit(), minimumScaleFactor(0.5)]}>{p.ready ? kcalBig : "–"}</Text>}>
        <Text>kcal</Text>
      </Gauge>
    );
  }
  if (family === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[url, frame({ maxWidth: 1000, alignment: "leading" })]}>
        <HStack spacing={4}>
          <Image systemName={p.trainedToday ? "checkmark.circle.fill" : "dumbbell.fill"} />
          <Text modifiers={[font({ size: 15, weight: "semibold" }), lineLimit(1)]}>{workoutLine}</Text>
        </HStack>
        <Text modifiers={[font({ size: 14 }), monospacedDigit(), lineLimit(1)]}>{`${kcalBig} ${kcalSmall}`}</Text>
        <Text modifiers={[font({ size: 13 }), monospacedDigit(), lineLimit(1), foregroundStyle({ type: "hierarchical", style: "secondary" })]}>{`${protein} protein`}</Text>
      </VStack>
    );
  }

  const background = containerBackground(bg, "widget");

  if (!p.ready) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[background, url, frame({ maxWidth: 1000, maxHeight: 1000, alignment: "topLeading" })]}>
        <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(green)]}>NICHOLASFIT</Text>
        <Spacer />
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(ink)]}>Open the app once to fill this in.</Text>
      </VStack>
    );
  }

  const header = (
    <HStack spacing={4}>
      <Image systemName={p.trainedToday ? "checkmark.circle.fill" : "dumbbell.fill"} modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle(green)]} />
      <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(green), lineLimit(1), minimumScaleFactor(0.8)]}>{workoutLine}</Text>
    </HStack>
  );

  const bar = p.kcalTarget ? <Gauge value={kcalFrac} modifiers={[gaugeStyle("linearCapacity"), tint(over ? amber : green)]} /> : null;

  if (family === "systemSmall") {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[background, url, frame({ maxWidth: 1000, maxHeight: 1000, alignment: "topLeading" })]}>
        {header}
        <Spacer />
        <Text modifiers={[font({ size: 34, weight: "bold", design: "rounded" }), monospacedDigit(), foregroundStyle(over ? amber : ink), minimumScaleFactor(0.6), lineLimit(1)]}>{kcalBig}</Text>
        <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted)]}>{kcalSmall}</Text>
        {bar}
        <Spacer />
        <Text modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.8)]}>{`${protein} protein`}</Text>
        <Text modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle(muted), lineLimit(1), minimumScaleFactor(0.8)]}>{weightLine}</Text>
      </VStack>
    );
  }

  // systemMedium
  const row = (icon: "fork.knife" | "scalemass" | "calendar", label: string, value: string) => (
    <HStack spacing={6}>
      <Image systemName={icon} modifiers={[font({ size: 12 }), foregroundStyle(muted), frame({ width: 16 })]} />
      <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{label}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: "semibold" }), monospacedDigit(), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.8)]}>{value}</Text>
    </HStack>
  );
  return (
    <HStack spacing={16} modifiers={[background, url]}>
      <VStack alignment="leading" spacing={2}>
        {header}
        <Spacer />
        <Text modifiers={[font({ size: 34, weight: "bold", design: "rounded" }), monospacedDigit(), foregroundStyle(over ? amber : ink), minimumScaleFactor(0.6), lineLimit(1)]}>{kcalBig}</Text>
        <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted)]}>{kcalSmall}</Text>
        {bar}
      </VStack>
      <VStack spacing={10} modifiers={[padding({ top: 2 })]}>
        {row("fork.knife", "Protein", protein)}
        {row("scalemass", "Weight", weightLine)}
        {row("calendar", "This week", `${p.sessions} / ${p.sessionGoal}`)}
        <Spacer />
      </VStack>
    </HStack>
  );
};

export default createWidget<TodayProps>("Today", Today, {
  trainedToday: false,
  sessions: 0,
  sessionGoal: 3,
  kcal: 0,
  protein: 0,
  ready: false,
});
