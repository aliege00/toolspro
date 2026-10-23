import type { ComponentType, ReactNode } from "react";
import {
  ArchiveIcon,
  Compress as CompressIcon,
  ImageIcon,
  InfoIcon,
  MusicIcon,
  ScissorsIcon,
  ShieldIcon,
} from "@/components/Icons";
import VideoToMp3 from "./VideoToMp3";
import AudioTrim from "./AudioTrim";
import ImageCompress from "./ImageCompress";
import ImageConvert from "./ImageConvert";
import ZipTool from "./ZipTool";
import HashTool from "./HashTool";
import VideoInfo from "./VideoInfo";
import type { ToolProps } from "./ToolFrame";

export type ToolMeta = {
  id: string;
  title: string;
  desc: string;
  icon: ReactNode;
  component: ComponentType<ToolProps>;
};

export const tools: ToolMeta[] = [
  {
    id: "video-to-mp3",
    title: "Video → MP3",
    desc: "Videonun sesini MP3 olarak çıkar",
    icon: <MusicIcon size={24} />,
    component: VideoToMp3,
  },
  {
    id: "audio-trim",
    title: "Ses Kırp",
    desc: "Başlangıç ve bitişi seç, kırp",
    icon: <ScissorsIcon size={24} />,
    component: AudioTrim,
  },
  {
    id: "image-compress",
    title: "Görsel Sıkıştır",
    desc: "Boyut ve kaliteyi ayarla",
    icon: <CompressIcon size={24} />,
    component: ImageCompress,
  },
  {
    id: "image-convert",
    title: "Görsel Dönüştür",
    desc: "JPEG, PNG veya WebP yap",
    icon: <ImageIcon size={24} />,
    component: ImageConvert,
  },
  {
    id: "zip",
    title: "Arşiv (ZIP)",
    desc: "Birden çok dosyayı sıkıştır",
    icon: <ArchiveIcon size={24} />,
    component: ZipTool,
  },
  {
    id: "hash",
    title: "Parmak İzi",
    desc: "Dosya bilgisi ve SHA-256",
    icon: <ShieldIcon size={24} />,
    component: HashTool,
  },
  {
    id: "video-info",
    title: "Video Bilgisi",
    desc: "Süre, çözünürlük ve codec desteği",
    icon: <InfoIcon size={24} />,
    component: VideoInfo,
  },
];

export function toolById(id: string): ToolMeta | undefined {
  return tools.find((t) => t.id === id);
}
