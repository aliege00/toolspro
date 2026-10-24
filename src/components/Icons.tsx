import type { ReactNode } from "react";

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

function Icon({
  size = 24,
  className,
  strokeWidth = 1.8,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
);

export const Play = ({ size = 24, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
  </svg>
);

export const Pause = ({ size = 24, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <rect x="6" y="4" width="4" height="16" rx="1.4" />
    <rect x="14" y="4" width="4" height="16" rx="1.4" />
  </svg>
);

export const Back10 = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 4v6h6" />
    <path d="M4.6 15a8.5 8.5 0 1 0 2-8.6L3 10" />
  </Icon>
);

export const Forward10 = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 4v6h-6" />
    <path d="M19.4 15a8.5 8.5 0 1 1-2-8.6L21 10" />
  </Icon>
);

export const Expand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </Icon>
);

export const Compress = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
  </Icon>
);

export const Sun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const Moon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Icon>
);

export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
);

export const XMark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1.5 14h5M9.5 8h5M17.5 16h5" />
  </Icon>
);

export const RepeatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 2.5l3 3-3 3" />
    <path d="M4 12.5v-2a4 4 0 0 1 4-4h12" />
    <path d="M7 21.5l-3-3 3-3" />
    <path d="M20 11.5v2a4 4 0 0 1-4 4H4" />
  </Icon>
);

export const Repeat1Icon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 2.5l3 3-3 3" />
    <path d="M4 12.5v-2a4 4 0 0 1 4-4h12" />
    <path d="M7 21.5l-3-3 3-3" />
    <path d="M20 11.5v2a4 4 0 0 1-4 4H4" />
    <text
      x="12"
      y="15.4"
      fontSize="7.5"
      fontWeight="700"
      fill="currentColor"
      stroke="none"
      textAnchor="middle"
    >
      1
    </text>
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20.5 20.5l-4.2-4.2" />
  </Icon>
);

export const HeartIcon = ({ size = 24, className, strokeWidth = 1.8 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 21.4l8.8-8.4a5.2 5.2 0 0 0 0-7.4z" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
  </Icon>
);

export const TrashBinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6h17" />
    <path d="M8.5 6V4.5A1.5 1.5 0 0 1 10 3h4a1.5 1.5 0 0 1 1.5 1.5V6" />
    <path d="M6 6l1 13.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 6" />
  </Icon>
);

export const StorageIcon = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5" />
  </Icon>
);

export const AlbumIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="14" rx="3" />
    <path d="M7 7V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V7" />
    <path d="M3 12.5h18" />
  </Icon>
);

export const SortIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
    <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
  </Icon>
);

export const DuplicateIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2.5" />
    <path d="M15.5 5.5V5A2 2 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2 2 0 0 0 5 15.5h.5" />
  </Icon>
);

export const QrIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM19.5 14H21M14 19.5V21M18 19.5h3v1.5M19.5 17h1.5" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    <path d="M5 11.5a7 7 0 0 0 14 0" />
    <path d="M12 18.5V22" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7.5h2.2l1.4-2h7.8l1.4 2h2.2A2.5 2.5 0 0 1 22 10v8a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18v-8a2.5 2.5 0 0 1 2.5-2.5z" />
    <circle cx="12" cy="14" r="3.5" />
  </Icon>
);

export const RenameIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Icon>
);

export const VideoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="5" width="14" height="14" rx="3" />
    <path d="M16 10.5l6-3.5v10l-6-3.5z" />
  </Icon>
);

export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </Icon>
);

export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.6 6.4a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.7-3.7a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.7 3.7z" />
  </Icon>
);

export const MusicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.6" />
    <path d="M21 15l-5-5L5 21" />
  </Icon>
);

export const FileIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M13 2v7h7" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 1.9" />
  </Icon>
);

export const ScissorsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="6" r="2.6" />
    <circle cx="6" cy="18" r="2.6" />
    <path d="M8.1 7.5L20 19M8.1 16.5L20 5M14 12l6 7" />
  </Icon>
);

export const ArchiveIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="3" width="19" height="5" rx="1.6" />
    <path d="M4.5 8v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8" />
    <path d="M10 12.5h4" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16.5v-5" />
    <path d="M12 8h.01" />
  </Icon>
);

export const GaugeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 18a9 9 0 1 1 15 0" />
    <path d="M12 14.5l4-4.5" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7.5 11l4.5 4.5L16.5 11" />
    <path d="M12 15V3" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6h17" />
    <path d="M8.5 6V4.5A1.5 1.5 0 0 1 10 3h4a1.5 1.5 0 0 1 1.5 1.5V6" />
    <path d="M6 6l1 13.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 6" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 22s8-3.5 8-9.5V5.5L12 2.5 4 5.5V12.5C4 18.5 12 22 12 22z" />
    <path d="M9 12l2 2 4-4.5" />
  </Icon>
);

export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.5l9.5 5-9.5 5-9.5-5 9.5-5z" />
    <path d="M2.5 12.5l9.5 5 9.5-5" />
  </Icon>
);
