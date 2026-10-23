import { useEffect, useState } from "react";
import { VideoIcon } from "./Icons";
import { videoThumb } from "@/lib/files";
import type { Entry } from "@/lib/library";

/** Video dosyası için küçük kare üretir; üretilemezse simge gösterir. */
export default function Thumb({
  entry,
  className = "",
}: {
  entry: Entry;
  className?: string;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setThumb(null);
    videoThumb(entry.url).then((data) => {
      if (alive) setThumb(data);
    });
    return () => {
      alive = false;
    };
  }, [entry.id, entry.url]);

  if (thumb) {
    return (
      <img
        src={thumb}
        alt=""
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-[#202024] text-white/60 ${className}`}
    >
      <VideoIcon size={26} />
    </div>
  );
}
