import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { OutputCard, ToolSection } from "./ToolFrame";
import { useOutputs } from "@/lib/outputs";
import type { Output } from "@/lib/outputs";
import { requestMicAccess } from "@/lib/native";
import { useT } from "@/i18n";

export default function VoiceRecorder() {
  const t = useT();
  const { addOutput } = useOutputs();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<Output | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | undefined>(undefined);

  const stopTimer = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = undefined;
  };

  useEffect(
    () => () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
    },
    [],
  );

  const start = async () => {
    setError(null);
    const granted = await requestMicAccess();
    if (!granted) {
      setError(t("recorder.error"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        const stamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[T:]/g, "-");
        if (blob.size > 0) {
          setOutput(addOutput(`kayit-${stamp}.${ext}`, blob, "Ses Kaydedici"));
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError(t("recorder.error"));
      setRecording(false);
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("tool.recorder.title")}>
        <div className="flex flex-col items-center gap-4 py-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => (recording ? stop() : void start())}
            aria-label={recording ? t("recorder.stop") : t("recorder.record")}
            className={`flex h-24 w-24 items-center justify-center rounded-full border-4 transition-colors ${
              recording ? "border-danger bg-danger/15" : "border-line bg-fill"
            }`}
          >
            <motion.span
              animate={recording ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={recording ? { repeat: Infinity, duration: 1.4 } : undefined}
              className={
                recording
                  ? "h-9 w-9 rounded-[10px] bg-danger"
                  : "h-10 w-10 rounded-full bg-danger"
              }
            />
          </motion.button>

          <p className="text-[15px] font-medium">
            {recording
              ? t("recorder.elapsed", { d: elapsed })
              : t("recorder.record")}
          </p>

          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      </ToolSection>

      <ToolSection title={t("section.info")}>
        <p className="text-[12.5px] leading-[1.45] text-ink2">
          {t("recorder.formatNote")}
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.45] text-ink2">
          {t("recorder.micNote")}
        </p>
      </ToolSection>

      {output && <OutputCard output={output} />}

      {!output && !recording && (
        <Button full variant="secondary" onClick={() => void start()}>
          {t("recorder.record")}
        </Button>
      )}
    </div>
  );
}
