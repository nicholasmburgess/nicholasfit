import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { activityBackgroundTint, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, progressViewStyle, tint } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

/**
 * The rest timer on the Lock Screen and in the Dynamic Island. iOS counts the timer down by
 * itself, so it keeps ticking with the app asleep. Once the rest is over (the activity goes
 * "stale" at its end time) it switches to "Rest done" and what's next.
 */
export type RestProps = {
  /** Rest started / ends, in ms since 1970. */
  startsAt: number;
  endsAt: number;
  /** "Up next: Bench press, 60 kg × 8" */
  upNext: string;
};

const RestTimer = (p: RestProps, env: LiveActivityEnvironment) => {
  "widget";
  const green = "#3cc47f";
  const range = { lower: new Date(p.startsAt), upper: new Date(Math.max(p.endsAt, p.startsAt + 1000)) };
  const done = env.isStale === true || Date.now() >= p.endsAt;
  const timer = (size: number) =>
    done ? (
      <Text modifiers={[font({ size, weight: "bold", design: "rounded" }), foregroundStyle(green)]}>Go</Text>
    ) : (
      <Text timerInterval={range} countsDown modifiers={[font({ size, weight: "bold", design: "rounded" }), monospacedDigit(), foregroundStyle(green), frame({ maxWidth: size * 3 })]} />
    );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), activityBackgroundTint("#0a0f0c")]}>
        <HStack spacing={8}>
          <Image systemName={done ? "bell.fill" : "timer"} modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(green)]} />
          <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle("#eef2ec"), lineLimit(1)]}>{done ? "Rest done" : "Rest"}</Text>
          <Spacer />
          {timer(30)}
        </HStack>
        {done ? null : <ProgressView timerInterval={range} countsDown={false} modifiers={[progressViewStyle("linear"), tint(green)]} />}
        <Text modifiers={[font({ size: 14 }), foregroundStyle("#b8c2bb"), lineLimit(2)]}>{p.upNext}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="timer" modifiers={[foregroundStyle(green)]} />,
    compactTrailing: timer(15),
    minimal: done ? <Image systemName="bell.fill" modifiers={[foregroundStyle(green)]} /> : <Text timerInterval={range} countsDown modifiers={[font({ size: 12, weight: "semibold" }), monospacedDigit(), foregroundStyle(green)]} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName="timer" modifiers={[foregroundStyle(green)]} />
        <Text modifiers={[font({ size: 15, weight: "semibold" })]}>{done ? "Rest done" : "Rest"}</Text>
      </HStack>
    ),
    expandedTrailing: timer(26),
    expandedBottom: (
      <VStack alignment="leading" spacing={6}>
        {done ? null : <ProgressView timerInterval={range} countsDown={false} modifiers={[progressViewStyle("linear"), tint(green)]} />}
        <Text modifiers={[font({ size: 14 }), foregroundStyle("#b8c2bb"), lineLimit(1)]}>{p.upNext}</Text>
      </VStack>
    ),
  };
};

export default createLiveActivity<RestProps>("RestTimer", RestTimer);
