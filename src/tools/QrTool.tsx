import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { Button, Segmented } from "@/components/ui";
import { OutputCard, ToolSection } from "./ToolFrame";
import { useOutputs } from "@/lib/outputs";
import type { Output } from "@/lib/outputs";
import { pickFiles } from "@/lib/files";
import { requestCameraAccess } from "@/lib/native";
import { useT } from "@/i18n";

export default function QrTool() {
  const t = useT();
  const { addOutput } = useOutputs();
  const [mode, setMode] = useState<"generate" | "scan">("generate");
  const [text, setText] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [output, setOutput] = useState<Output | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  // Kamera arka planda açık kalırsa pil ve gizlilik açısından kötüdür.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stopCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopCamera();
    };
  }, [stopCamera]);

  const generate = async () => {
    const value = text.trim();
    if (!value) return;
    setScanError(null);
    try {
      const dataUrl = await QRCode.toDataURL(value, {
        margin: 1,
        width: 640,
        color: { dark: "#000000ff", light: "#ffffffff" },
      });
      const blob = await (await fetch(dataUrl)).blob();
      setOutput(addOutput("qr-kod.png", blob, "QR Kod"));
    } catch {
      setScanError(t("qr.noQr"));
    }
  };

  const scanFromImage = async () => {
    setScanError(null);
    setScanResult(null);
    const files = await pickFiles({ accept: "image/*" });
    const file = files[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(image.data, image.width, image.height);
      if (found?.data) setScanResult(found.data);
      else setScanError(t("qr.noQr"));
    } catch {
      setScanError(t("qr.noQr"));
    }
  };

  const startCamera = async () => {
    setScanError(null);
    setScanResult(null);
    const granted = await requestCameraAccess();
    if (!granted) {
      setScanError(t("qr.cameraError"));
      return;
    }
    // Önceki akış açık kaldıysa kamerayı iki kez meşgul etme.
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      // Video öğesi cameraOn'dan bağımsız olarak bağlı kalır; aksi hâlde
      // ilk açılışta ref henüz yokken kamera başlatılamıyordu.
      const video = videoRef.current;
      if (!video) throw new Error("video");
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);

      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      let lastScan = 0;

      const tick = (now: number) => {
        if (!streamRef.current) return;
        // Saniyede ~4 tarama yeterli: her karede tam çözünürlükte
        // getImageData + jsQR çalıştırmak CPU'yu ve pili tüketiyordu.
        if (now - lastScan < 250) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastScan = now;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height);
            if (found?.data) {
              setScanResult(found.data);
              stopCamera();
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      stopCamera();
      setScanError(t("qr.cameraError"));
    }
  };

  const isOpenableUrl =
    !!scanResult && /^https?:\/\//i.test(scanResult);

  return (
    <div className="space-y-5">
      <div className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]">
        <Segmented
          layoutId="qr-mode"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setScanError(null);
            setScanResult(null);
            stopCamera();
          }}
          options={[
            { value: "generate", label: t("qr.generate") },
            { value: "scan", label: t("qr.scanImage") },
          ]}
        />
      </div>

      {mode === "generate" ? (
        <ToolSection title={t("qr.generate")}>
          <div className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("qr.placeholder")}
              rows={3}
              className="w-full resize-none rounded-[13px] bg-fill px-4 py-3 text-[15px] outline-none placeholder:text-ink3"
            />
            <Button full onClick={() => void generate()} disabled={!text.trim()}>
              {t("qr.generate")}
            </Button>
            {scanError && <p className="text-[13px] text-danger">{scanError}</p>}
          </div>
        </ToolSection>
      ) : (
        <ToolSection title={t("qr.scanImage")}>
          <div className="space-y-3">
            <Button full variant="secondary" onClick={() => void scanFromImage()}>
              {t("qr.scanImage")}
            </Button>
            <Button full variant="gray" onClick={() => void startCamera()}>
              {t("qr.camera")}
            </Button>

            <div
              aria-hidden={!cameraOn}
              className={
                cameraOn
                  ? "overflow-hidden"
                  : "pointer-events-none fixed top-0 -left-[9999px] h-px w-px overflow-hidden opacity-0"
              }
            >
              <div className="relative overflow-hidden rounded-[14px] bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="aspect-square w-full object-cover"
                />
                <span className="absolute inset-x-0 top-2 text-center text-[12.5px] text-white/85">
                  {t("qr.cameraScanning")}
                </span>
              </div>
              <Button full variant="ghost" size="md" onClick={stopCamera}>
                {t("qr.stopCamera")}
              </Button>
            </div>

            {scanError && <p className="text-[13px] text-danger">{scanError}</p>}
          </div>
        </ToolSection>
      )}

      {scanResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <p className="mb-2 text-[12px] font-semibold text-ink2 uppercase">QR</p>
          <p className="text-[14px] leading-[1.45] break-all">{scanResult}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void navigator.clipboard.writeText(scanResult)}
            >
              {t("common.copy")}
            </Button>
            {isOpenableUrl && (
              <Button
                size="sm"
                variant="gray"
                onClick={() => window.open(scanResult, "_blank", "noopener")}
              >
                ↗
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {output && <OutputCard output={output} />}
    </div>
  );
}
