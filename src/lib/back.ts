import { useEffect, useRef } from "react";

type BackHandler = () => boolean | void;

const handlers: { token: symbol; handler: BackHandler }[] = [];

export function pushBackHandler(handler: BackHandler): () => void {
  const token = Symbol("back");
  handlers.push({ token, handler });
  return () => {
    const index = handlers.findIndex((entry) => entry.token === token);
    if (index !== -1) handlers.splice(index, 1);
  };
}

/**
 * Android geri tuşunda en son açılan katman önce kapanır.
 * true dönerse geri tuşu tüketilmiş olur; gezinme yığınına geçilmez.
 */
export function runBackHandler(): boolean {
  const top = handlers[handlers.length - 1];
  if (!top) return false;
  const handled = top.handler();
  return handled !== false;
}

/** Açık bir katman (sayfa, modal, klavye) geri tuşunu yakalasın. */
export function useBackHandler(active: boolean, handler: BackHandler) {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => latest.current());
  }, [active]);
}
