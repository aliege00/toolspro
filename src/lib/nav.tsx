import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Route =
  | { name: "home" }
  | { name: "video"; fileId?: string }
  | { name: "files" }
  | { name: "tools" }
  | { name: "settings" }
  | { name: "tool"; id: string; fileId?: string };

type NavCtx = {
  stack: Route[];
  current: Route;
  direction: 1 | -1;
  push: (route: Route) => void;
  pop: () => void;
  reset: (route: Route) => void;
};

const Ctx = createContext<NavCtx | null>(null);

export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);
  const [direction, setDirection] = useState<1 | -1>(1);

  const push = useCallback((route: Route) => {
    setDirection(1);
    setStack((s) => [...s, route]);
  }, []);

  const pop = useCallback(() => {
    setDirection(-1);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const reset = useCallback((route: Route) => {
    setDirection(1);
    setStack([route]);
  }, []);

  const value: NavCtx = {
    stack,
    current: stack[stack.length - 1],
    direction,
    push,
    pop,
    reset,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
