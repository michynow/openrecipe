import { copy } from "@openrecipe/core/copy";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import Svg, { G, Path, Circle, Rect } from "react-native-svg";

import { useTokens } from "../../lib/theme";

/** MC Kiełbas: a smug sausage with a pencil moustache and a grape bow tie (port of the web SVG). */
export function Kielbas({ talking = false, size = 80 }: { talking?: boolean; size?: number }) {
  const { color } = useTokens();
  const line = color.line;
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessible={false}>
      <G
        transform="rotate(-6 48 52)"
        stroke={line}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path fill="none" d="M48 12V5M43 3l5 3 5-3" />
        <Rect fill={color.sausage} x={22} y={10} width={52} height={92} rx={26} />
        <Path stroke={color.surface} fill="none" opacity={0.45} d="M31 24q-5 18 0 36" />
        <Path fill="none" d="M28 66l7-5M28 75l7-5" />
        <Circle fill={color.surface} cx={40} cy={38} r={6.5} />
        <Circle fill={color.surface} cx={57} cy={38} r={6.5} />
        <Circle fill={line} stroke="none" cx={41} cy={40.5} r={2.4} />
        <Circle fill={line} stroke="none" cx={58} cy={40.5} r={2.4} />
        <Path fill={color.sausage} d="M33.5 38a6.5 6.5 0 0 1 13 0z" />
        <Path fill={color.sausage} d="M50.5 38a6.5 6.5 0 0 1 13 0z" />
        <Path fill="none" d="M33 28l11 2" />
        <Path fill="none" d="M51 27q6-6 12-1" />
        <Path fill={line} d="M37 52q5-4 11 0q6-4 11 0q-5 3-11 1q-6 2-11-1z" />
        {talking ? (
          <Path fill={line} d="M41 57q8 10 15 0q-7 3-15 0z" />
        ) : (
          <Path fill="none" d="M41 58q8 5 15-3" />
        )}
        <Path fill={color.accent2} d="M48 82L33 73v18zM48 82l15-9v18z" />
        <Rect fill={color.accent2} x={44.5} y={78.5} width={7} height={7} rx={2} />
      </G>
    </Svg>
  );
}

/** Milliseconds per typed character: game dialogue speed. */
const TYPE_MS = 22;

/** Game dialogue box: portrait, name plate, typed-out text. Tap skips the typing, then advances. */
export function DialogueBox({ lines, onDone }: { lines: string[]; onDone?: () => void }) {
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const text = lines[line] ?? "";
  const typing = typed < text.length;
  const last = line === lines.length - 1;

  useEffect(() => {
    if (!typing) return;
    const step = reduceMotion ? text.length : 1;
    const timer = setInterval(() => setTyped((n) => Math.min(n + step, text.length)), TYPE_MS);
    return () => clearInterval(timer);
  }, [typing, text.length, reduceMotion]);

  function advance() {
    if (typing) return setTyped(text.length);
    if (last) return onDone?.();
    setLine(line + 1);
    setTyped(0);
  }

  return (
    <Pressable
      onPress={advance}
      accessibilityRole="button"
      accessibilityLabel={text}
      className="mb-[5px] mr-[5px] mt-3"
    >
      <View className="absolute inset-0 left-[5px] top-[5px] rounded-card bg-line" />
      <View className="flex-row gap-3 rounded-card border-[3px] border-line bg-surface p-3 pt-6">
        <View className="absolute -top-4 left-4 rounded-input border-2 border-line bg-gold px-3 py-0.5">
          <Text className="font-display text-base uppercase text-ink">{copy.help.name}</Text>
        </View>
        <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-input border-2 border-line bg-fill">
          <Kielbas talking={typing && typed % 6 < 3} size={72} />
        </View>
        <View className="min-h-20 flex-1 justify-between gap-2">
          <Text className="font-body text-base leading-snug text-text">{text.slice(0, typed)}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="font-body text-sm text-muted">
              {line + 1}/{lines.length}
            </Text>
            <Text className="font-display text-sm uppercase text-accent">
              {last && !typing ? copy.help.close : copy.help.next} {typing ? "" : "▼"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
