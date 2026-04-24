// app/(tabs)/setting/BrainTraining.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authFetch } from "../../../utils/api";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import { palette, pressShadow, radius, shadow, spacing, typeScale, webShell } from "../../../constants/design";

type IconName = keyof typeof Ionicons.glyphMap;
type Card = { id: string; key: string; icon: IconName; flipped: boolean; matched: boolean };

// ---- ?곗텧 ?뚮씪誘명꽣 ----
const FLIP_MS = 900;
const MISMATCH_HOLD_MS = 900;
const REVEAL_STAGGER_MS = 70;
const REVEAL_HOLD_MS = 1500;
const HIDE_MS = 900;

const ICON_POOL: IconName[] = [
  "heart","leaf","flash","moon","sunny","cloud","star","cellular","airplane","bicycle","bonfire","bulb",
  "football","fitness","flame","beaker","calculator","pizza","happy","musical-notes","rocket","trophy",
  "planet","watch","medkit","notifications","sparkles","game-controller","umbrella","water",
];

const COLS = 4, PAIRS = 12, CARD_MARGIN = 8, H_PADDING = 16;
const PERSPECTIVE = 800;
const { width: SCREEN_W } = Dimensions.get("window");
const BOARD_WIDTH = Math.min(SCREEN_W - H_PADDING * 2, 360);
const CARD_SIZE = Math.floor((BOARD_WIDTH - CARD_MARGIN * (COLS - 1)) / COLS);

// ??status 湲???ш쾶(諛섏쓳??
const FS_STATUS = typeScale.body;

// ??踰꾪듉 ?ш린/湲??諛섏쓳???좏겙 異붽?
const FS_BTN = typeScale.body;

function pickRandom<T>(arr: T[], n: number): T[] {
  const src = [...arr], out: T[] = [];
  for (let i = 0; i < n && src.length; i++) out.push(src.splice(Math.floor(Math.random() * src.length), 1)[0]);
  return out;
}

function buildDeck(): Card[] {
  const chosen = pickRandom(ICON_POOL, PAIRS);
  const pairs = chosen.flatMap((icon, i) => {
    const k = `k${i}`;
    return [
      { id: `${k}-a`, key: k, icon, flipped: false, matched: false },
      { id: `${k}-b`, key: k, icon, flipped: false, matched: false },
    ] as Card[];
  });

  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

type ScoreEntry = { score: number; createdAt: string };

// ?? 異붿꽭 李⑦듃 而댄룷?뚰듃 ??????????????????????????????????????
const CHART_W = BOARD_WIDTH;
const CHART_H = 100;
const CHART_PAD = { top: 12, bottom: 20, left: 28, right: 8 };

function ScoreTrendChart({ data }: { data: ScoreEntry[] }) {
  if (data.length < 2) return null;
  const scores = [...data].reverse().map(d => d.score);
  const n = scores.length;
  const minS = Math.max(0, Math.min(...scores) - 5);
  const maxS = Math.min(100, Math.max(...scores) + 5);
  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const px = (i: number) => CHART_PAD.left + (i / (n - 1)) * innerW;
  const py = (s: number) => CHART_PAD.top + (1 - (s - minS) / (maxS - minS)) * innerH;

  const points = scores.map((s, i) => `${px(i)},${py(s)}`).join(" ");

  return (
    <View style={{ marginTop: 6, marginBottom: 4 }}>
      <Text style={styles.chartTitle}>Score Trend (last {n} games)</Text>
      <Svg width={CHART_W} height={CHART_H}>
        {/* 湲곗???*/}
        <Line x1={CHART_PAD.left} y1={CHART_PAD.top} x2={CHART_PAD.left} y2={CHART_PAD.top + innerH} stroke="#cbd5e1" strokeWidth={1} />
        <Line x1={CHART_PAD.left} y1={CHART_PAD.top + innerH} x2={CHART_W - CHART_PAD.right} y2={CHART_PAD.top + innerH} stroke="#cbd5e1" strokeWidth={1} />
        {/* Y異??덉씠釉?*/}
        <SvgText x={CHART_PAD.left - 4} y={CHART_PAD.top + 4} fontSize={9} fill="#8A9692" textAnchor="end">{Math.round(maxS)}</SvgText>
        <SvgText x={CHART_PAD.left - 4} y={CHART_PAD.top + innerH + 4} fontSize={9} fill="#8A9692" textAnchor="end">{Math.round(minS)}</SvgText>
        {/* 爰얠???*/}
        <Polyline points={points} fill="none" stroke="#0F766E" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* ??*/}
        {scores.map((s, i) => (
          <Circle key={i} cx={px(i)} cy={py(s)} r={3.5} fill="#0F766E" />
        ))}
      </Svg>
    </View>
  );
}

export default function BrainTraining() {
  const [deck, setDeck] = useState<Card[]>(buildDeck());
  const [active, setActive] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    const loadBest = async () => {
      try {
        const userId = await AsyncStorage.getItem("userId");
        if (!userId) return;
        const res = await authFetch(`/api/brain-training/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setBestScore(data.bestScore ?? 0);
          setScoreHistory(data.recent ?? []);
        }
      } catch {}
    };
    loadBest();
  }, []);

  const opened = useRef<number[]>([]);
  const resolving = useRef(false);

  const [isLocked, setIsLocked] = useState(false);
  const lock = () => { resolving.current = true; setIsLocked(true); };
  const unlock = () => { resolving.current = false; setIsLocked(false); };

  const flips = useMemo(() => deck.map(() => new Animated.Value(0)), [deck.length]);

  const flipTo = (i: number, to: 0 | 1, ms = FLIP_MS) =>
    Animated.timing(flips[i], {
      toValue: to,
      duration: ms,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });

  const revealOnly = async () => {
    setDeck(d => d.map(c => ({ ...c, flipped: true, matched: false })));
    await new Promise<void>((resolve) => {
      Animated.stagger(
        REVEAL_STAGGER_MS,
        flips.map(v =>
          Animated.timing(v, {
            toValue: 1,
            duration: FLIP_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start(() => resolve());
    });
  };

  const startFlow = async () => {
    setActive(false); setMoves(0); setMatches(0); opened.current = [];
    setDeck(d => d.map(c => ({ ...c, flipped: false, matched: false })));
    flips.forEach(v => v.setValue(0));

    await revealOnly();
    await new Promise(r => setTimeout(r, REVEAL_HOLD_MS));

    await new Promise<void>((resolve) => {
      Animated.parallel(
        flips.map(v =>
          Animated.timing(v, {
            toValue: 0,
            duration: HIDE_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start(() => resolve());
    });

    setDeck(d => d.map(c => ({ ...c, flipped: false })));
    setActive(true);
  };

  const onStart = async () => {
    if (resolving.current) return;
    lock();
    await startFlow();
    unlock();
  };

  const onRestart = async () => {
    if (resolving.current) return;
    lock();
    setDeck(buildDeck());
    await new Promise(r => setTimeout(r, 0));
    flips.forEach(v => v.setValue(0));
    await startFlow();
    unlock();
  };

  const onPressCard = useCallback(async (idx: number) => {
    if (!active || resolving.current) return;

    const c = deck[idx];
    if (c.matched || c.flipped) return;
    if (opened.current.length === 2) return;

    lock();

    await new Promise<void>(r => flipTo(idx, 1).start(() => r()));
    setDeck(d => {
      const cp = [...d];
      cp[idx] = { ...cp[idx], flipped: true };
      return cp;
    });
    opened.current.push(idx);

    if (opened.current.length < 2) {
      unlock();
      return;
    }

    setMoves(m => m + 1);
    const [a, b] = opened.current;
    const A = deck[a], B = deck[b];

    if (A.key === B.key) {
      setDeck(d => {
        const cp = [...d];
        cp[a] = { ...cp[a], matched: true };
        cp[b] = { ...cp[b], matched: true };
        return cp;
      });

      setMatches(m => {
        const next = m + 1;
        if (next === PAIRS) {
          const finalMoves = moves + 1;
          const score = Math.max(0, 100 - finalMoves);

          AsyncStorage.getItem("userId").then(userId => {
            if (!userId) return;
            authFetch(`/api/brain-training/${userId}`, {
              method: "POST",
              body: JSON.stringify({ score }),
            }).then(res => {
              if (res.ok) {
                res.json().then(data => {
                  const best = data.bestScore ?? score;
                  setBestScore(best);
                  // 異붿꽭 李⑦듃 ?덉뒪?좊━ 媛깆떊 (理쒖떊 湲곕줉 prepend, 理쒕? 10媛?
                  setScoreHistory(prev => [
                    { score, createdAt: new Date().toISOString() },
                    ...prev,
                  ].slice(0, 10));
                  setTimeout(() => {
                    Alert.alert(
                      "Game Completed!",
                      `All cards matched!\nMoves: ${finalMoves}\nScore: ${score}\nBest Score: ${best}`
                    );
                  }, 300);
                });
              } else {
                setTimeout(() => {
                  Alert.alert(
                    "Game Completed",
                    `You matched all the cards!\nMoves: ${finalMoves}\nScore: ${score}`
                  );
                }, 300);
              }
            }).catch(() => {
              setTimeout(() => {
                Alert.alert(
                  "Game Completed",
                  `You matched all the cards!\nMoves: ${finalMoves}\nScore: ${score}`
                );
              }, 300);
            });
          });

          setActive(false);
        }
        return next;
      });

      opened.current = [];
      unlock();
    } else {
      setTimeout(() => {
        Animated.parallel([flipTo(a, 0), flipTo(b, 0)]).start(() => {
          setDeck(d => {
            const cp = [...d];
            cp[a] = { ...cp[a], flipped: false };
            cp[b] = { ...cp[b], flipped: false };
            return cp;
          });
          opened.current = [];
          unlock();
        });
      }, MISMATCH_HOLD_MS);
    }
  }, [active, deck, moves]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
        <View style={styles.summaryPanel}>
          <View style={styles.statusRow}>
            <Text style={styles.status}>Matches: {matches}/{PAIRS}</Text>
            <Text style={styles.status}>Moves: {moves}</Text>
          </View>
          {bestScore !== null && (
            <View style={styles.bestRow}>
              <Text style={styles.bestText}>Best Score: {bestScore}</Text>
            </View>
          )}
          <ScoreTrendChart data={scoreHistory} />
        </View>

        <View style={styles.boardPanel}>
        <View style={styles.grid}>
          {deck.map((card, i) => {
            const frontRotateY = flips[i].interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "180deg"],
            });
            const backRotateY = flips[i].interpolate({
              inputRange: [0, 1],
              outputRange: ["180deg", "360deg"],
            });

            return (
              <TouchableOpacity
                key={card.id}
                style={[styles.card, card.matched && { opacity: 0.6 }]}
                activeOpacity={0.9}
                onPress={() => onPressCard(i)}
                disabled={!active || isLocked}
              >
                <View style={styles.flipWrap}>
                  <Animated.View
                    style={[
                      styles.face,
                      { transform: [{ perspective: PERSPECTIVE }, { rotateY: frontRotateY }] },
                    ]}
                  >
                    <Ionicons name="help" size={24} color={palette.faint} />
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.face,
                      styles.faceBack,
                      { transform: [{ perspective: PERSPECTIVE }, { rotateY: backRotateY }] },
                    ]}
                  >
                    <Ionicons name={card.icon} size={30} color={palette.ink} />
                  </Animated.View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={onStart}
            disabled={isLocked}
            activeOpacity={0.9}
          >
            <Text style={styles.btnTextPrimary}>Start</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btn}
            onPress={onRestart}
            disabled={isLocked}
            activeOpacity={0.9}
          >
            <Text style={styles.btnText}>Restart</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 118,
  },
  shell: {
    ...webShell,
    gap: spacing.md,
  },
  summaryPanel: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.md,
    ...shadow,
  },
  statusRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  status: { color: palette.ink, fontWeight: "900", fontSize: FS_STATUS },
  bestRow: { alignItems: "center", marginTop: spacing.xs },
  bestText: { color: palette.primaryDark, fontWeight: "900", fontSize: typeScale.meta },

  boardPanel: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.sm,
    alignItems: "center",
    ...shadow,
  },
  grid: { width: BOARD_WIDTH, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: radius.card,
    backgroundColor: palette.surfaceMuted,
    marginBottom: CARD_MARGIN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
  },

  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },

  // ??踰꾪듉 ?ш린 ?ㅼ?
  btn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radius.card,
    minWidth: Math.min(180, Math.max(132, BOARD_WIDTH * 0.32)),
    alignItems: "center",
    ...pressShadow,
  },
  btnPrimary: { backgroundColor: palette.primary, borderColor: palette.primary },

  // ??踰꾪듉 湲???ㅼ?
  btnText: { color: palette.ink, fontWeight: "900", fontSize: FS_BTN },
  btnTextPrimary: { color: palette.surface, fontWeight: "900", fontSize: FS_BTN },

  chartTitle: { fontSize: typeScale.caption, color: palette.muted, fontWeight: "800", marginBottom: spacing.xs, textAlign: "center" },

  flipWrap: { width: "100%", height: "100%", position: "relative" },
  face: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden" as any,
  },
  faceBack: {},
});
