import { Platform, type ViewStyle } from "react-native";

export const palette = {
  ink: "#13201c",
  muted: "#66736f",
  faint: "#8a9692",
  canvas: "#f4faf6",
  canvasDeep: "#e6f3ec",
  surface: "#ffffff",
  surfaceMuted: "#f8fbf9",
  line: "#dbe7e1",
  primary: "#0f766e",
  primaryDark: "#115e59",
  primarySoft: "#d9f2ec",
  signal: "#f59e0b",
  signalSoft: "#fff4d8",
  rescue: "#e11d48",
  rescueSoft: "#ffe4ea",
  clinical: "#0d9488",
  clinicalSoft: "#d9f2ec",
  success: "#059669",
  successSoft: "#dcfce7",
} as const;

export const typeScale = {
  hero: 34,
  title: 26,
  section: 20,
  cardTitle: 18,
  body: 16,
  meta: 14,
  caption: 12,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  card: 8,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
} as const;

export const webShell: ViewStyle = {
  width: "100%",
  maxWidth: Platform.OS === "web" ? 520 : undefined,
  alignSelf: "center",
};

export const shadow = {
  shadowColor: "#0b2b24",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 4,
} as const;

export const pressShadow = {
  shadowColor: "#0b2b24",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 14,
  elevation: 3,
} as const;
