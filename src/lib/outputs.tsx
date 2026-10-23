import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { detectKind, newId } from "./files";
import type { Kind } from "./files";

export type Output = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  kind: Kind;
  size: number;
  tool: string;
  createdAt: number;
};

type OutputsCtx = {
  outputs: Output[];
  addOutput: (name: string, blob: Blob, tool: string) => Output;
  removeOutput: (id: string) => void;
  clearOutputs: () => void;
};

const Ctx = createContext<OutputsCtx | null>(null);

export function OutputsProvider({ children }: { children: ReactNode }) {
  const [outputs, setOutputs] = useState<Output[]>([]);

  const addOutput = useCallback((name: string, blob: Blob, tool: string) => {
    const output: Output = {
      id: newId(),
      name,
      blob,
      url: URL.createObjectURL(blob),
      kind: detectKind(new File([blob], name)),
      size: blob.size,
      tool,
      createdAt: Date.now(),
    };
    setOutputs((prev) => [output, ...prev]);
    return output;
  }, []);

  const removeOutput = useCallback((id: string) => {
    setOutputs((prev) => {
      const target = prev.find((o) => o.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((o) => o.id !== id);
    });
  }, []);

  const clearOutputs = useCallback(() => {
    setOutputs((prev) => {
      for (const o of prev) URL.revokeObjectURL(o.url);
      return [];
    });
  }, []);

  const value = useMemo(
    () => ({ outputs, addOutput, removeOutput, clearOutputs }),
    [outputs, addOutput, removeOutput, clearOutputs],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOutputs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOutputs must be used within OutputsProvider");
  return ctx;
}
