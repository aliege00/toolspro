import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { CameraIcon, FileIcon, XMark } from "@/components/Icons";
import { OutputCard, RunArea, ToolSection, useRunner } from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { requestCameraAccess } from "@/lib/native";
import { useT } from "@/i18n";

type ScanPage = { file: File; url: string };

const MAX_PAGES = 30;

export default function ScannerTool(_props: ToolProps) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pagesRef = useRef<ScanPage[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const { status, progress, error, result, run, cancel } = useRunner();

  pagesRef.current = pages;

  const stopCamera = () => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      for (const page of pagesRef.current) URL.revokeObjectURL(page.url);
    };
  }, []);

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => undefined);
  }, [cameraOn]);

  const openCamera = async () => {
    setStarting(true);
    setCameraError(null);
    setNotice(null);
    try {
      const granted = await requestCameraAccess();
      if (!granted) {
        setCameraError(t("scanner.permission"));
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(t("scanner.unsupported"));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setCameraError(t("scanner.cameraError"));
    } finally {
      setStarting(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setNotice(t("scanner.notReady"));
      return;
    }
    if (pages.length >= MAX_PAGES) {
      setNotice(t("scanner.maxPages", { n: MAX_PAGES }));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setNotice(t("scanner.cameraError"));
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) {
      setNotice(t("scanner.cameraError"));
      return;
    }
    const index = pages.length + 1;
    const file = new File([blob], `tarama-${index}.jpg`, { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    setPages((prev) => [...prev, { file, url }]);
    setNotice(t("scanner.captured", { n: index }));
  };

  const removePage = (index: number) => {
    setPages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearPages = () => {
    for (const page of pagesRef.current) URL.revokeObjectURL(page.url);
    setPages([]);
    setNotice(null);
  };

  const start = () => {
    if (pages.length === 0) return;
    void run("Belge Tarama", async (onProgress, signal) => {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const A4: [number, number] = [595.28, 841.89];
      const margin = 20;

      for (let i = 0; i < pages.length; i += 1) {
        if (signal.aborted) throw new DOMException("İptal", "AbortError");
        const bytes = new Uint8Array(await pages[i].file.arrayBuffer());
        const image = await doc.embedJpg(bytes);
        const page = doc.addPage(A4);
        const maxW = A4[0] - margin * 2;
        const maxH = A4[1] - margin * 2;
        const scale = Math.min(maxW / image.width, maxH / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: (A4[0] - width) / 2,
          y: (A4[1] - height) / 2,
          width,
          height,
        });
        onProgress(((i + 1) / pages.length) * 0.9);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const bytes = await doc.save();
      onProgress(1);
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        name: "tarama.pdf",
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("scanner.camera")}>
        {cameraOn ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[12px] bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="max-h-[320px] w-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button full size="md" onClick={() => void capture()}>
                {t("scanner.capture")}
              </Button>
              <Button size="md" variant="gray" onClick={stopCamera}>
                {t("scanner.close")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void openCamera()}
              disabled={starting}
              className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill disabled:opacity-60"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
                <CameraIcon size={22} />
              </div>
              <div>
                <p className="text-[15px] font-semibold">
                  {starting ? t("scanner.opening") : t("scanner.open")}
                </p>
                <p className="text-[12.5px] text-ink2">{t("scanner.openNote")}</p>
              </div>
            </button>
            <p className="text-[12.5px] leading-[1.45] text-ink2">{t("scanner.note")}</p>
          </div>
        )}
        {cameraError && (
          <p className="mt-3 rounded-[10px] bg-danger/10 px-3 py-2.5 text-[12.5px] leading-[1.45] text-danger">
            {cameraError}
          </p>
        )}
      </ToolSection>

      <ToolSection title={t("scanner.pages", { n: pages.length })}>
        {pages.length === 0 ? (
          <p className="text-[13px] text-ink2">{t("scanner.empty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {pages.map((page, index) => (
              <div key={page.url} className="relative overflow-hidden rounded-[10px] bg-fill">
                <img src={page.url} alt="" className="aspect-[3/4] w-full object-cover" />
                <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removePage(index)}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white active:opacity-70"
                  aria-label={t("scanner.deletePage")}
                >
                  <XMark size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {pages.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12.5px] text-ink2">
              <FileIcon size={15} /> {t("scanner.ready", { n: pages.length })}
            </span>
            <Button size="sm" variant="ghost" onClick={clearPages}>
              {t("scanner.clear")}
            </Button>
          </div>
        )}
        {notice && <p className="mt-2 text-[12.5px] text-ink2">{notice}</p>}
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("scanner.run")}
        disabled={pages.length === 0}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
