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
  TextIcon,
  LayersIcon,
  RotateIcon,
  WaveformIcon,
  BatchIcon,
  GaugeIcon,
  VolumeIcon,
} from "@/components/Icons";
import VideoToMp3 from "./VideoToMp3";
import VideoTrim from "./VideoTrim";
import VideoJoin from "./VideoJoin";
import VideoCompress from "./VideoCompress";
import VideoRotate from "./VideoRotate";
import VideoMute from "./VideoMute";
import VideoWatermark from "./VideoWatermark";
import SubtitleBurn from "./SubtitleBurn";
import OcrTool from "./OcrTool";
import AudioTrim from "./AudioTrim";
import AudioJoin from "./AudioJoin";
import BatchConvert from "./BatchConvert";
import ImageCompress from "./ImageCompress";
import ImageConvert from "./ImageConvert";
import ImageEdit from "./ImageEdit";
import ImageMetadata from "./ImageMetadata";
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
import VideoSpeed from "./VideoSpeed";
import AudioConvert from "./AudioConvert";
import AudioSpeed from "./AudioSpeed";
import PptxToPdf from "./PptxToPdf";
import TextToPdf from "./TextToPdf";
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
    id: "video-trim",
    titleKey: "tool.videoTrim.title",
    descKey: "tool.videoTrim.desc",
    icon: <ScissorsIcon size={24} />,
    component: VideoTrim,
  },
  {
    id: "video-join",
    titleKey: "tool.videoJoin.title",
    descKey: "tool.videoJoin.desc",
    icon: <LayersIcon size={24} />,
    component: VideoJoin,
  },
  {
    id: "video-mute",
    titleKey: "tool.videoMute.title",
    descKey: "tool.videoMute.desc",
    icon: <VolumeIcon size={24} />,
    component: VideoMute,
  },
  {
    id: "video-compress",
    titleKey: "tool.videoCompress.title",
    descKey: "tool.videoCompress.desc",
    icon: <CompressIcon size={24} />,
    component: VideoCompress,
  },
  {
    id: "video-rotate",
    titleKey: "tool.videoRotate.title",
    descKey: "tool.videoRotate.desc",
    icon: <RotateIcon size={24} />,
    component: VideoRotate,
  },
  {
    id: "video-watermark",
    titleKey: "tool.videoWatermark.title",
    descKey: "tool.videoWatermark.desc",
    icon: <TextIcon size={24} />,
    component: VideoWatermark,
  },
  {
    id: "subtitle-burn",
    titleKey: "tool.subBurn.title",
    descKey: "tool.subBurn.desc",
    icon: <LayersIcon size={24} />,
    component: SubtitleBurn,
  },
  {
    id: "video-speed",
    titleKey: "tool.videoSpeed.title",
    descKey: "tool.videoSpeed.desc",
    icon: <GaugeIcon size={24} />,
    component: VideoSpeed,
  },
  {
    id: "ocr",
    titleKey: "tool.ocr.title",
    descKey: "tool.ocr.desc",
    icon: <TextIcon size={24} />,
    component: OcrTool,
  },
  {
    id: "audio-trim",
    titleKey: "tool.audioTrim.title",
    descKey: "tool.audioTrim.desc",
    icon: <ScissorsIcon size={24} />,
    component: AudioTrim,
  },
  {
    id: "audio-join",
    titleKey: "tool.audioJoin.title",
    descKey: "tool.audioJoin.desc",
    icon: <WaveformIcon size={24} />,
    component: AudioJoin,
  },
  {
    id: "audio-speed",
    titleKey: "tool.audioSpeed.title",
    descKey: "tool.audioSpeed.desc",
    icon: <GaugeIcon size={24} />,
    component: AudioSpeed,
  },
  {
    id: "audio-convert",
    titleKey: "tool.audioConvert.title",
    descKey: "tool.audioConvert.desc",
    icon: <MusicIcon size={24} />,
    component: AudioConvert,
  },
  {
    id: "batch",
    titleKey: "tool.batch.title",
    descKey: "tool.batch.desc",
    icon: <BatchIcon size={24} />,
    component: BatchConvert,
  },
  {
    id: "image-compress",
    titleKey: "tool.imageCompress.title",
    descKey: "tool.imageCompress.desc",
    icon: <CompressIcon size={24} />,
    component: ImageCompress,
  },
  {
    id: "image-edit",
    titleKey: "tool.imageEdit.title",
    descKey: "tool.imageEdit.desc",
    icon: <RotateIcon size={24} />,
    component: ImageEdit,
  },
  {
    id: "image-metadata",
    titleKey: "tool.imageMetadata.title",
    descKey: "tool.imageMetadata.desc",
    icon: <ShieldIcon size={24} />,
    component: ImageMetadata,
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
    id: "text-pdf",
    titleKey: "tool.textPdf.title",
    descKey: "tool.textPdf.desc",
    icon: <TextIcon size={24} />,
    component: TextToPdf,
  },
  {
    id: "pptx-pdf",
    titleKey: "tool.pptxPdf.title",
    descKey: "tool.pptxPdf.desc",
    icon: <FileIcon size={24} />,
    component: PptxToPdf,
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
