import { useEffect, useRef, useState } from "react";
import { VideoIcon } from "./Icons";
import { peekVideoThumb, videoThumb } from "@/lib/files";
import type { Entry } from "@/lib/library";
import { usePowerSaver } from "@/lib/power";

/**
 * Video dosyası için küçük kare üretir; üretilemezse simge gösterir.
 * Kare yalnızca hücre ekrana girdiğinde ve uygulama ön plandayken üretilir;
 * böylece uzun listelerde onlarca video öğesi açılıp pil tüketmez.
 */
export default function Thumb({
  entry,
  className = "",
}: {
  entry: Entry;
  className?: string;
}) {
  const { saver } = usePowerSaver();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [thumb, setThumb] = useState<string | null>(() =>
    peekVideoThumb(entry.url),
  );

  useEffect(() => {
    if (visible) return;
    const host = hostRef.current;
    if (!host) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || saver || thumb) return;
    let alive = true;
    setThumb(peekVideoThumb(entry.url));
    const load = () => {
      if (document.visibilityState === "hidden") return;
      void videoThumb(entry.url).then((data) => {
        if (alive && data) setThumb(data);
      });
    };
    load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [visible, saver, thumb, entry.url]);

  return (
    <div ref={hostRef} className="h-full w-full">
      {thumb && !saver ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover ${className}`}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-tile text-tile-ink ${className}`}
        >
          <VideoIcon size={26} />
        </div>
      )}
    </div>
  );
}
