import type { ComponentType, ReactNode } from "react";
import {
  AlbumIcon,
  ArchiveIcon,
  CameraIcon,
  Compress as CompressIcon,
  FileIcon,
  ImageIcon,
  InfoIcon,
  MicIcon,
  MusicIcon,
  QrIcon,
  RenameIcon,
  RepeatIcon,
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
import FrameCapture from "./FrameCapture";
import VideoToGif from "./VideoToGif";
import QrTool from "./QrTool";
import ImageToPdf from "./ImageToPdf";
import PdfMerge from "./PdfMerge";
import PdfSplit from "./PdfSplit";
import RenameTool from "./RenameTool";
import VoiceRecorder from "./VoiceRecorder";
import type { ToolProps } from "./ToolFrame";

export type ToolMeta = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: ReactNode;
  component: ComponentType<ToolProps>;
};

export const tools: ToolMeta[] = [
  {
    id: "video-to-mp3",
    titleKey: "tool.videoToMp3.title",
    descKey: "tool.videoToMp3.desc",
    icon: <MusicIcon size={24} />,
    component: VideoToMp3,
  },
  {
    id: "audio-trim",
    titleKey: "tool.audioTrim.title",
    descKey: "tool.audioTrim.desc",
    icon: <ScissorsIcon size={24} />,
    component: AudioTrim,
  },
  {
    id: "image-compress",
    titleKey: "tool.imageCompress.title",
    descKey: "tool.imageCompress.desc",
    icon: <CompressIcon size={24} />,
    component: ImageCompress,
  },
  {
    id: "image-convert",
    titleKey: "tool.imageConvert.title",
    descKey: "tool.imageConvert.desc",
    icon: <ImageIcon size={24} />,
    component: ImageConvert,
  },
  {
    id: "frame",
    titleKey: "tool.frame.title",
    descKey: "tool.frame.desc",
    icon: <CameraIcon size={24} />,
    component: FrameCapture,
  },
  {
    id: "gif",
    titleKey: "tool.gif.title",
    descKey: "tool.gif.desc",
    icon: <RepeatIcon size={24} />,
    component: VideoToGif,
  },
  {
    id: "qr",
    titleKey: "tool.qr.title",
    descKey: "tool.qr.desc",
    icon: <QrIcon size={24} />,
    component: QrTool,
  },
  {
    id: "image-pdf",
    titleKey: "tool.imagePdf.title",
    descKey: "tool.imagePdf.desc",
    icon: <FileIcon size={24} />,
    component: ImageToPdf,
  },
  {
    id: "pdf-merge",
    titleKey: "tool.pdfMerge.title",
    descKey: "tool.pdfMerge.desc",
    icon: <AlbumIcon size={24} />,
    component: PdfMerge,
  },
  {
    id: "pdf-split",
    titleKey: "tool.pdfSplit.title",
    descKey: "tool.pdfSplit.desc",
    icon: <ScissorsIcon size={24} />,
    component: PdfSplit,
  },
  {
    id: "zip",
    titleKey: "tool.zip.title",
    descKey: "tool.zip.desc",
    icon: <ArchiveIcon size={24} />,
    component: ZipTool,
  },
  {
    id: "rename",
    titleKey: "tool.rename.title",
    descKey: "tool.rename.desc",
    icon: <RenameIcon size={24} />,
    component: RenameTool,
  },
  {
    id: "recorder",
    titleKey: "tool.recorder.title",
    descKey: "tool.recorder.desc",
    icon: <MicIcon size={24} />,
    component: VoiceRecorder,
  },
  {
    id: "hash",
    titleKey: "tool.hash.title",
    descKey: "tool.hash.desc",
    icon: <ShieldIcon size={24} />,
    component: HashTool,
  },
  {
    id: "video-info",
    titleKey: "tool.videoInfo.title",
    descKey: "tool.videoInfo.desc",
    icon: <InfoIcon size={24} />,
    component: VideoInfo,
  },
];

export function toolById(id: string): ToolMeta | undefined {
  return tools.find((t) => t.id === id);
}
