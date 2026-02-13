// app/(tabs)/setting/BrainTraining.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

type IconName = keyof typeof Ionicons.glyphMap;
type Card = { id: string; key: string; icon: IconName; flipped: boolean; matched: boolean };

// ---- 연출 파라미터 ----
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
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_SIZE = Math.floor((SCREEN_W - H_PADDING * 2 - CARD_MARGIN * (COLS - 1)) / COLS);

// ✅ status 글씨 크게(반응형)
const FS_STATUS = Math.max(14, SCREEN_W * 0.048);

// ✅ 버튼 크기/글씨 반응형 토큰 추가
const BTN_PV = Math.max(12, SCREEN_H * 0.016);        // 세로 패딩 (기존 10보다 큼)
const BTN_PH = Math.max(18, SCREEN_W * 0.06);         // 가로 패딩 (기존 16보다 큼)
const BTN_R = Math.max(10, SCREEN_W * 0.03);          // radius 약간 키움
const FS_BTN = Math.max(15, SCREEN_W * 0.045);        // 버튼 글씨 크게

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

export default function BrainTraining() {
  const [deck, setDeck] = useState<Card[]>(buildDeck());
  const [active, setActive] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);

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

          setTimeout(() => {
            Alert.alert(
              "Game Completed 🎉",
              `You matched all the cards!\nMoves: ${finalMoves}\nScore: ${score}`
            );
          }, 300);

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
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SCREEN_H * 0.03 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusRow}>
          <Text style={styles.status}>Matches: {matches}/{PAIRS}</Text>
          <Text style={styles.status}>Moves: {moves}</Text>
        </View>

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
                    <Ionicons name="help" size={24} color="#94a3b8" />
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.face,
                      styles.faceBack,
                      { transform: [{ perspective: PERSPECTIVE }, { rotateY: backRotateY }] },
                    ]}
                  >
                    <Ionicons name={card.icon} size={30} color="#111827" />
                  </Animated.View>
                </View>
              </TouchableOpacity>
            );
          })}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff", paddingHorizontal: H_PADDING },

  statusRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  status: { color: "#334155", fontWeight: "700", fontSize: FS_STATUS },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginBottom: CARD_MARGIN,
    alignItems: "center",
    justifyContent: "center",
  },

  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    paddingBottom: 16,
  },

  // ✅ 버튼 크기 키움
  btn: {
    paddingVertical: BTN_PV,
    paddingHorizontal: BTN_PH,
    borderRadius: BTN_R,
    backgroundColor: "#eef2f7",
    minWidth: SCREEN_W * 0.32,     // ✅ 버튼 최소 너비(확실히 커 보이게)
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#26B4E5" },

  // ✅ 버튼 글씨 키움
  btnText: { color: "#111827", fontWeight: "800", fontSize: FS_BTN },
  btnTextPrimary: { color: "#fff", fontWeight: "900", fontSize: FS_BTN },

  flipWrap: { width: "100%", height: "100%", position: "relative" },
  face: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden" as any,
  },
  faceBack: {},
});
