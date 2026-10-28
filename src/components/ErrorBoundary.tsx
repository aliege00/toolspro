import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { logError } from "@/lib/errorLog";
import { copyText } from "@/lib/clipboard";
import { useT } from "@/i18n";
import { Button } from "./ui";

function FatalScreen({ error }: { error: Error }) {
  const t = useT();
  return (
    <div className="safe-top safe-bottom flex min-h-full flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-fill text-[22px] font-semibold text-ink2">
        !
      </div>
      <h1 className="mt-4 text-[19px] font-semibold">{t("error.boundaryTitle")}</h1>
      <p className="mt-1.5 max-w-[320px] text-[13.5px] leading-[1.5] text-ink2">
        {t("error.boundaryDesc")}
      </p>
      <p className="mt-3 max-h-28 w-full max-w-[320px] overflow-y-auto rounded-[10px] bg-fill px-3 py-2 text-left text-[11.5px] leading-[1.45] break-words text-ink2">
        {error.message}
      </p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={() => window.location.reload()}>
          {t("error.reload")}
        </Button>
        <Button
          size="sm"
          variant="gray"
          onClick={() => void copyText(`${error.message}\n${error.stack ?? ""}`)}
        >
          {t("error.copy")}
        </Button>
      </div>
    </div>
  );
}

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("render", `${error.message}\n${info.componentStack ?? ""}`);
  }

  render() {
    if (this.state.error) return <FatalScreen error={this.state.error} />;
    return this.props.children;
  }
}
