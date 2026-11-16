import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type PowerCtx = {
  /** Açıkken ağır animasyonlar ve video küçük kareleri üretilmez. */
  saver: boolean;
  toggle: () => void;
  setSaver: (next: boolean) => void;
};

const Ctx = createContext<PowerCtx>({
  saver: false,
  toggle: () => {},
  setSaver: () => {},
});

export function PowerProvider({ children }: { children: ReactNode }) {
  const [saver, setSaverState] = useState(
    () => localStorage.getItem("medya.powerSaver") === "1",
  );

  useEffect(() => {
    localStorage.setItem("medya.powerSaver", saver ? "1" : "0");
    document.documentElement.dataset.power = saver ? "on" : "off";
  }, [saver]);

  const setSaver = useCallback((next: boolean) => setSaverState(next), []);
  const toggle = useCallback(() => setSaverState((value) => !value), []);

  return (
    <Ctx.Provider value={{ saver, toggle, setSaver }}>{children}</Ctx.Provider>
  );
}

export function usePowerSaver() {
  return useContext(Ctx);
}
