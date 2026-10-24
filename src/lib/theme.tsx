import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeCtx = {
  theme: Theme;
  toggle: () => void;
  accent: string;
  setAccent: (id: string) => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "light",
  toggle: () => {},
  accent: "blue",
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  const [accent, setAccentState] = useState<string>(
    () => localStorage.getItem("medya.accent") || "blue",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("medya.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    localStorage.setItem("medya.accent", accent);
  }, [accent]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  const setAccent = useCallback((id: string) => setAccentState(id), []);

  return <Ctx.Provider value={{ theme, toggle, accent, setAccent }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
