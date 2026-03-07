import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type FontScale = "small" | "normal" | "large";

const FONT_SCALE_KEY = "fontScale";

const SCALE_MAP: Record<FontScale, number> = {
  small: 0.85,
  normal: 1.0,
  large: 1.2,
};

type FontSizeContextType = {
  fontScale: FontScale;
  multiplier: number;
  setFontScale: (scale: FontScale) => Promise<void>;
};

const FontSizeContext = createContext<FontSizeContextType>({
  fontScale: "normal",
  multiplier: 1.0,
  setFontScale: async () => {},
});

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>("normal");

  useEffect(() => {
    AsyncStorage.getItem(FONT_SCALE_KEY).then((val) => {
      if (val === "small" || val === "normal" || val === "large") {
        setFontScaleState(val);
      }
    });
  }, []);

  const setFontScale = async (scale: FontScale) => {
    setFontScaleState(scale);
    await AsyncStorage.setItem(FONT_SCALE_KEY, scale);
  };

  return (
    <FontSizeContext.Provider
      value={{ fontScale, multiplier: SCALE_MAP[fontScale], setFontScale }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  return useContext(FontSizeContext);
}
