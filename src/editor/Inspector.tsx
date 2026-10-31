import { Button, Slider, Toggle } from "@/components/ui";
import {
  CopyIcon,
  FlipHIcon,
  FlipVIcon,
  LayersIcon,
  MicIcon,
  MusicIcon,
  PlusIcon,
  RotateIcon,
  ScissorsIcon,
  TextIcon,
  TrashBinIcon,
  UndoIcon,
  RedoIcon,
  VolumeIcon,
} from "@/components/Icons";
import { formatBytes, formatDuration } from "@/lib/files";
import type { Entry } from "@/lib/library";
import type { Clip, FilterPreset, Project, TextAlign, TextAnim, TextVAlign, TrackKind, TransitionId } from "./types";
import { ASPECTS, SPEED_MAX, SPEED_MIN, trackAccepts } from "./types";
import { useEditorT } from "./labels";
import { usePacks } from "@/packs/PacksProvider";
import type { PackMusicItem, PackStickerItem } from "@/packs/types";


const PRESETS: FilterPreset[] = ["none", "bw", "sepia", "vignette"];
const FONTS = [
  { id: "system", key: "fontSystem" },
  { id: "serif", key: "fontSerif" },
  { id: "mono", key: "fontMono" },
] as const;
const TEXT_COLORS = ["#ffffff", "#d1d1d6", "#8e8e93", "#48484a", "#1c1c1e", "#b08968"];
const ANIMS: TextAnim[] = ["none", "fade", "slide", "zoom"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 px-1 text-[11.5px] font-semibold tracking-wide text-ink3 uppercase">
      {children}
    </h3>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-card p-3.5 shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}

function PackMediaPanel({
  music,
  stickers,
  onAddMusic,
  onAddSticker,
}: {
  music: PackMusicItem[];
  stickers: PackStickerItem[];
  onAddMusic: (item: PackMusicItem) => void;
  onAddSticker: (item: PackStickerItem) => void;
}) {
  const t = useEditorT();
  return (
    <section>
      <SectionLabel>{t("packContent")}</SectionLabel>
      <Panel>
        {stickers.length > 0 && (
          <>
            <p className="mb-1.5 text-[11.5px] text-ink3">{t("stickers")}</p>
            <div className="flex flex-wrap gap-1.5">
              {stickers.map((item) => (
                <button
                  key={`${item.packId}/${item.id}`}
                  type="button"
                  onClick={() => onAddSticker(item)}
                  className="min-h-[34px] rounded-[9px] border border-line bg-fill/40 px-2.5 text-[11.5px] font-medium text-ink2 active:opacity-60"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
        {music.length > 0 && (
          <>
            <p className={`mb-1.5 text-[11.5px] text-ink3 ${stickers.length > 0 ? "mt-3" : ""}`}>
              {t("packMusic")}
            </p>
            <div className="flex flex-col gap-1.5">
              {music.map((item) => (
                <button
                  key={`${item.packId}/${item.id}`}
                  type="button"
                  onClick={() => onAddMusic(item)}
                  className="flex min-h-[40px] items-center justify-between gap-3 rounded-[9px] bg-fill px-3 text-left active:opacity-60"
                >
                  <span className="truncate text-[12.5px] font-medium">{item.title}</span>
                  <span className="shrink-0 text-[10.5px] text-ink3">
                    {item.duration > 0 ? t("seconds", { n: item.duration }) : item.artist}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <p className="mt-2.5 text-[10.5px] leading-[1.4] text-ink3">{t("packContentNote")}</p>
      </Panel>
    </section>
  );
}

function IconAction({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-[12px] bg-fill px-2 py-2 text-[10.5px] font-medium active:opacity-60 ${
        danger ? "text-danger" : "text-ink2"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function Inspector({
  project,
  clip,
  entry,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPatchClip,
  onPatchProject,
  onSplit,
  onDuplicate,
  onDelete,
  onAddTrack,
  onAddMedia,
  onAddText,
  onImportSrt,
  onMoveToTrack,
  trackKind,
  recording,
  onAddMusic,
  onToggleVoiceover,
  onDetachAudio,
  onAddPip,
  onAddPackMusic,
  onAddSticker,
}: {
  project: Project;
  clip: Clip | null;
  entry?: Entry;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPatchClip: (clipId: string, patch: Partial<Clip>, mergeKey?: string) => void;
  onPatchProject: (patch: Partial<Project>, mergeKey?: string) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddTrack: (kind: TrackKind) => void;
  onAddMedia: () => void;
  onAddText: () => void;
  onImportSrt: () => void;
  onMoveToTrack: (trackId: string) => void;
  trackKind: TrackKind | null;
  recording: boolean;
  onAddMusic: () => void;
  onToggleVoiceover: () => void;
  onDetachAudio: () => void;
  onAddPip: () => void;
  onAddPackMusic: (item: PackMusicItem) => void;
  onAddSticker: (item: PackStickerItem) => void;
}) {
  const t = useEditorT();
  const {
    transitions: packTransitions,
    filters: packFilters,
    fonts: packFonts,
    music: packMusic,
    stickers: packStickers,
  } = usePacks();
  const isText = clip?.kind === "text";
  const hasAudio = clip?.kind === "video" || clip?.kind === "audio";
  const transitionOptions: { id: TransitionId; label: string }[] = [
    { id: "none", label: t("none") },
    { id: "fade", label: t("fade") },
    { id: "slide", label: t("slide") },
    { id: "zoom", label: t("zoom") },
    ...packTransitions.map((item) => ({ id: item.id, label: item.label })),
  ];
  const fontOptions = [
    ...FONTS.map((font) => ({ id: font.id as string, label: t(font.key) })),
    ...packFonts.map((font) => ({ id: font.fontId, label: font.label })),
  ];

  const patch = (value: Partial<Clip>, key: string) => {
    if (!clip) return;
    onPatchClip(clip.id, value, `${clip.id}:${key}`);
  };

  // Seçili klibin izi ve taşınabileceği diğer izler.
  const containingTrack = clip
    ? project.tracks.find((track) => track.clips.some((item) => item.id === clip.id)) ?? null
    : null;
  const otherTracks = clip
    ? project.tracks.filter(
        (track) => track.id !== containingTrack?.id && trackAccepts(track.kind, clip.kind),
      )
    : [];

  return (
    <div className="space-y-5 px-4 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-medium tracking-wide text-ink3 uppercase">
            {t("project")}
          </span>
          <span className="text-[11.5px] text-ink3">
            {t("clipCount", { n: project.tracks.reduce((n, track) => n + track.clips.length, 0) })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-fill text-ink2 disabled:opacity-30"
            aria-label={t("undo")}
          >
            <UndoIcon size={16} />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-fill text-ink2 disabled:opacity-30"
            aria-label={t("redo")}
          >
            <RedoIcon size={16} />
          </button>
        </div>
      </div>

      {!clip ? (
        <>
          <Panel>
            <div className="flex flex-col items-center py-3 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-tile text-tile-ink">
                <ScissorsIcon size={21} />
              </span>
              <p className="mt-2.5 text-[15px] font-semibold">{t("noSelection")}</p>
              <p className="mt-1 max-w-[260px] text-[12.5px] leading-[1.45] text-ink2">
                {t("noSelectionDesc")}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="md" variant="secondary" className="flex-1" onClick={onAddMedia}>
                <PlusIcon size={16} />
                {t("addMedia")}
              </Button>
              <Button size="md" variant="gray" className="flex-1" onClick={onAddText}>
                <TextIcon size={16} />
                {t("addText")}
              </Button>
            </div>
          </Panel>

          <section>
            <SectionLabel>{t("aspect")}</SectionLabel>
            <Panel>
              <div className="grid grid-cols-4 gap-2">
                {ASPECTS.map((aspect) => {
                  const active = project.aspect === aspect.id;
                  const [w, h] = aspect.ratio.split(" / ").map(Number);
                  return (
                    <button
                      key={aspect.id}
                      type="button"
                      onClick={() => onPatchProject({ aspect: aspect.id }, "aspect")}
                      className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[11px] border px-1 py-2 active:opacity-70 ${
                        active
                          ? "border-ink/60 bg-fill text-ink"
                          : "border-line bg-fill/40 text-ink2"
                      }`}
                    >
                      <span
                        className="rounded-[2px] border border-current opacity-70"
                        style={{
                          width: w > h ? 22 : 22 * (w / h),
                          height: h > w ? 22 : 22 * (h / w),
                        }}
                      />
                      <span className="text-[10.5px] font-medium">{aspect.label}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </section>

          <section>
            <SectionLabel>{t("addTrack")}</SectionLabel>
            <Panel>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onAddTrack("overlay")}
                  className="flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[11px] bg-fill text-ink2 active:opacity-60"
                >
                  <LayersIcon size={18} />
                  <span className="text-[10.5px]">{t("addOverlayTrack")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddTrack("audio")}
                  className="flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[11px] bg-fill text-ink2 active:opacity-60"
                >
                  <MusicIcon size={18} />
                  <span className="text-[10.5px]">{t("addAudioTrack")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddTrack("text")}
                  className="flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[11px] bg-fill text-ink2 active:opacity-60"
                >
                  <TextIcon size={18} />
                  <span className="text-[10.5px]">{t("addTextTrack")}</span>
                </button>
              </div>
            </Panel>
          </section>

          <section>
            <SectionLabel>{t("addMedia")}</SectionLabel>
            <Panel>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onAddMusic}
                  className="flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[11px] bg-fill text-ink2 active:opacity-60"
                >
                  <MusicIcon size={18} />
                  <span className="text-[10.5px]">{t("addMusic")}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleVoiceover}
                  className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[11px] active:opacity-60 ${
                    recording ? "bg-ink text-bg" : "bg-fill text-ink2"
                  }`}
                >
                  <MicIcon size={18} />
                  <span className="text-[10.5px]">
                    {recording ? t("stop") : t("voiceover")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onAddPip}
                  className="flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[11px] bg-fill text-ink2 active:opacity-60"
                >
                  <LayersIcon size={18} />
                  <span className="text-[10.5px]">{t("pip")}</span>
                </button>
              </div>
              <p className="mt-2 px-0.5 text-[10.5px] leading-[1.4] text-ink3">
                {t("musicNote")}
              </p>
            </Panel>
          </section>

          <section>
            <SectionLabel>{t("importSubs")}</SectionLabel>
            <Panel>
              <button
                type="button"
                onClick={onImportSrt}
                className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[11px] bg-fill text-ink2 active:opacity-60"
              >
                <TextIcon size={18} />
                <span className="text-[12.5px] font-medium">{t("importSubs")}</span>
              </button>
              <p className="mt-2 px-0.5 text-[10.5px] leading-[1.4] text-ink3">
                {t("importSubsNote")}
              </p>
            </Panel>
          </section>

          <p className="px-1 text-center text-[11.5px] leading-[1.45] text-ink3">
            {t("localNote")}
          </p>
        </>
      ) : (
        <>
          <div className="rounded-[16px] bg-card p-3.5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{clip.name}</p>
                <p className="mt-0.5 text-[12px] text-ink2">
                  {formatDuration(clip.start)} → {formatDuration(clip.start + clip.duration)}
                  {" · "}
                  {clip.speed}x
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tile text-tile-ink">
                {clip.kind === "text" ? (
                  <TextIcon size={17} />
                ) : clip.kind === "audio" ? (
                  <MusicIcon size={17} />
                ) : (
                  <ScissorsIcon size={17} />
                )}
              </span>
            </div>

            {!entry && clip.kind !== "text" && (
              <p className="mt-2 rounded-[9px] bg-fill px-2.5 py-2 text-[11.5px] leading-[1.4] text-danger">
                {t("sourceMissing")} {clip.sourceType ? `(${clip.sourceType})` : ""}
              </p>
            )}
            {entry && (
              <p className="mt-1.5 text-[11px] text-ink3">
                {formatBytes(entry.size)} · {entry.file.type || entry.name.split(".").pop()}
              </p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <IconAction label={t("split")} icon={<ScissorsIcon size={18} />} onClick={onSplit} />
              <IconAction label={t("duplicate")} icon={<CopyIcon size={18} />} onClick={onDuplicate} />
              <IconAction
                label={t("deleteClip")}
                icon={<TrashBinIcon size={18} />}
                onClick={onDelete}
                danger
              />
            </div>            </div>

            {otherTracks.length > 0 && (
              <section className="mt-4">
                <SectionLabel>{t("moveTrack")}</SectionLabel>
                <Panel>
                  <div className="flex flex-wrap gap-1.5">
                    {otherTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => onMoveToTrack(track.id)}
                        className="min-h-[36px] rounded-[9px] border border-line bg-fill/40 px-3 text-[11.5px] font-medium text-ink2 active:opacity-60"
                      >
                        {track.name}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 px-0.5 text-[10.5px] leading-[1.4] text-ink3">
                    {t("moveTrackNote")}
                  </p>
                </Panel>
              </section>
            )}

          {hasAudio && clip.freezeAt === undefined && (
            <section>
              <SectionLabel>{t("speed")}</SectionLabel>
              <Panel>
                <Slider
                  label={t("speed")}
                  display={`${clip.speed.toFixed(2)}x`}
                  min={SPEED_MIN}
                  max={SPEED_MAX}
                  step={0.05}
                  value={clip.speed}
                  onChange={(value) => patch({ speed: value }, "speed")}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px]">{t("reverse")}</p>
                    <p className="mt-0.5 text-[11px] leading-[1.35] text-ink3">
                      {t("reverseNote")}
                    </p>
                  </div>
                  <Toggle
                    checked={clip.reverse}
                    onChange={(value) => patch({ reverse: value }, "reverse")}
                    label={t("reverse")}
                  />
                </div>
              </Panel>
            </section>
          )}

          {hasAudio && (
            <section>
              <SectionLabel>{t("volume")}</SectionLabel>
              <Panel>
                <Slider
                  label={t("volume")}
                  display={`${Math.round(clip.volume * 100)}%`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={clip.volume}
                  onChange={(value) => patch({ volume: value }, "volume")}
                />
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Slider
                    label={t("fadeIn")}
                    display={t("seconds", { n: clip.fadeIn.toFixed(1) })}
                    min={0}
                    max={5}
                    step={0.1}
                    value={clip.fadeIn}
                    onChange={(value) =>
                      patch(
                        { fadeIn: Math.min(value, clip.duration / 2) },
                        "fadeIn",
                      )
                    }
                  />
                  <Slider
                    label={t("fadeOut")}
                    display={t("seconds", { n: clip.fadeOut.toFixed(1) })}
                    min={0}
                    max={5}
                    step={0.1}
                    value={clip.fadeOut}
                    onChange={(value) =>
                      patch(
                        { fadeOut: Math.min(value, clip.duration / 2) },
                        "fadeOut",
                      )
                    }
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="md" variant="gray" onClick={onAddMusic}>
                    <MusicIcon size={15} />
                    {t("addMusic")}
                  </Button>
                  <Button size="md" variant="gray" onClick={onToggleVoiceover}>
                    <MicIcon size={15} />
                    {recording ? t("stop") : t("voiceover")}
                  </Button>
                </div>
                {clip.kind === "video" && (
                  <Button
                    full
                    size="md"
                    variant="ghost"
                    className="mt-1.5"
                    onClick={onDetachAudio}
                  >
                    <VolumeIcon size={15} />
                    {t("detachAudio")}
                  </Button>
                )}
              </Panel>
            </section>
          )}

          {(clip.kind === "video" || clip.kind === "image") && (
            <>
              <section>
                <SectionLabel>{t("transition")}</SectionLabel>
                <Panel>
                  <div className="grid grid-cols-4 gap-1 rounded-[10px] bg-fill p-1">
                    {transitionOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => patch({ transitionIn: option.id }, "transition")}
                        className={`rounded-[8px] px-1 py-2 text-[11px] font-medium ${
                          clip.transitionIn === option.id
                            ? "bg-card text-ink shadow-[var(--shadow-card)]"
                            : "text-ink2"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {clip.transitionIn !== "none" && (
                    <div className="mt-2">
                      <Slider
                        label={t("duration")}
                        display={t("seconds", { n: clip.transitionDuration.toFixed(1) })}
                        min={0.2}
                        max={1.5}
                        step={0.1}
                        value={clip.transitionDuration}
                        onChange={(value) => patch({ transitionDuration: value }, "transitionDuration")}
                      />
                    </div>
                  )}
                </Panel>
              </section>

              <section>
                <SectionLabel>{t("filter")}</SectionLabel>
                <Panel>
                  <div className="grid grid-cols-4 gap-1 rounded-[10px] bg-fill p-1">
                    {PRESETS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          patch(
                            { filter: { ...clip.filter, preset: option } },
                            "filterPreset",
                          )
                        }
                        className={`rounded-[8px] px-1 py-2 text-[10.5px] font-medium ${
                          clip.filter.preset === option
                            ? "bg-card text-ink shadow-[var(--shadow-card)]"
                            : "text-ink2"
                        }`}
                      >
                        {t(option)}
                      </button>
                    ))}
                  </div>
                  {packFilters.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {packFilters.map((preset) => {
                        const active =
                          clip.filter.preset === "none" &&
                          clip.filter.brightness === preset.brightness &&
                          clip.filter.contrast === preset.contrast &&
                          clip.filter.saturation === preset.saturation;
                        return (
                          <button
                            key={`${preset.packId}/${preset.id}`}
                            type="button"
                            onClick={() =>
                              patch(
                                {
                                  filter: {
                                    preset: "none",
                                    brightness: preset.brightness,
                                    contrast: preset.contrast,
                                    saturation: preset.saturation,
                                  },
                                },
                                "filterPreset",
                              )
                            }
                            className={`min-h-[34px] rounded-[9px] border px-2.5 text-[11px] font-medium active:opacity-60 ${
                              active
                                ? "border-ink/60 bg-fill text-ink"
                                : "border-line bg-fill/40 text-ink2"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    <Slider
                      label={t("brightness")}
                      display={`${clip.filter.brightness > 0 ? "+" : ""}${clip.filter.brightness}`}
                      min={-100}
                      max={100}
                      step={5}
                      value={clip.filter.brightness}
                      onChange={(value) =>
                        patch({ filter: { ...clip.filter, brightness: value } }, "brightness")
                      }
                    />
                    <Slider
                      label={t("contrast")}
                      display={`${clip.filter.contrast > 0 ? "+" : ""}${clip.filter.contrast}`}
                      min={-100}
                      max={100}
                      step={5}
                      value={clip.filter.contrast}
                      onChange={(value) =>
                        patch({ filter: { ...clip.filter, contrast: value } }, "contrast")
                      }
                    />
                    <Slider
                      label={t("saturation")}
                      display={`${clip.filter.saturation > 0 ? "+" : ""}${clip.filter.saturation}`}
                      min={-100}
                      max={100}
                      step={5}
                      value={clip.filter.saturation}
                      onChange={(value) =>
                        patch({ filter: { ...clip.filter, saturation: value } }, "saturation")
                      }
                    />
                  </div>
                </Panel>
              </section>

              {clip.kind === "video" && (
                <section>
                  <SectionLabel>{t("freeze")}</SectionLabel>
                  <Panel>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px]">{t("freeze")}</p>
                      <Toggle
                        checked={clip.freezeAt !== undefined}
                        onChange={(value) =>
                          patch(
                            value
                              ? {
                                  freezeAt: clip.inPoint,
                                  duration: Math.max(1.5, Math.min(5, clip.sourceDuration)),
                                }
                              : { freezeAt: undefined },
                            "freezeToggle",
                          )
                        }
                        label={t("freeze")}
                      />
                    </div>
                    {clip.freezeAt !== undefined && (
                      <div className="mt-2">
                        <Slider
                          label={t("freezeAt")}
                          display={t("seconds", { n: clip.freezeAt.toFixed(1) })}
                          min={0}
                          max={Math.max(0.1, clip.sourceDuration)}
                          step={0.1}
                          value={clip.freezeAt}
                          onChange={(value) => patch({ freezeAt: value }, "freezeAt")}
                        />
                      </div>
                    )}
                  </Panel>
                </section>
              )}

              {clip.kind === "image" && (
                <section>
                  <SectionLabel>{t("kenBurns")}</SectionLabel>
                  <Panel>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px]">{t("kenBurns")}</p>
                      <Toggle
                        checked={!!clip.kenBurns}
                        onChange={(value) => patch({ kenBurns: value }, "kenBurns")}
                        label={t("kenBurns")}
                      />
                    </div>
                  </Panel>
                </section>
              )}
            </>
          )}

          {trackKind === "overlay" && (
            <section>
              <SectionLabel>{t("pip")}</SectionLabel>
              <Panel>
                <Slider
                  label={t("pipScale")}
                  display={`${Math.round((clip.pip?.scale ?? 0.35) * 100)}%`}
                  min={0.15}
                  max={0.8}
                  step={0.01}
                  value={clip.pip?.scale ?? 0.35}
                  onChange={(value) =>
                    patch(
                      {
                        pip: {
                          scale: value,
                          x: Math.min(clip.pip?.x ?? 0.6, 1 - value),
                          y: Math.min(clip.pip?.y ?? 0.08, 1 - value),
                        },
                      },
                      "pipScale",
                    )
                  }
                />
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Slider
                    label={t("pipX")}
                    display={`${Math.round((clip.pip?.x ?? 0.6) * 100)}%`}
                    min={0}
                    max={Math.max(0, 1 - (clip.pip?.scale ?? 0.35))}
                    step={0.01}
                    value={clip.pip?.x ?? 0.6}
                    onChange={(value) =>
                      patch(
                        {
                          pip: {
                            scale: clip.pip?.scale ?? 0.35,
                            y: clip.pip?.y ?? 0.08,
                            x: value,
                          },
                        },
                        "pipX",
                      )
                    }
                  />
                  <Slider
                    label={t("pipY")}
                    display={`${Math.round((clip.pip?.y ?? 0.08) * 100)}%`}
                    min={0}
                    max={Math.max(0, 1 - (clip.pip?.scale ?? 0.35))}
                    step={0.01}
                    value={clip.pip?.y ?? 0.08}
                    onChange={(value) =>
                      patch(
                        {
                          pip: {
                            scale: clip.pip?.scale ?? 0.35,
                            x: clip.pip?.x ?? 0.6,
                            y: value,
                          },
                        },
                        "pipY",
                      )
                    }
                  />
                </div>
              </Panel>
            </section>
          )}

          {!isText && (
            <section>
              <SectionLabel>{t("rotate")}</SectionLabel>
              <Panel>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      patch({ rotate: ((clip.rotate + 90) % 360) as Clip["rotate"] }, "rotate")
                    }
                    className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-[11px] bg-fill text-[13px] font-medium text-ink2 active:opacity-60"
                  >
                    <RotateIcon size={17} />
                    {clip.rotate}°
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ flipH: !clip.flipH }, "flipH")}
                    aria-label={t("flipH")}
                    className={`flex h-[46px] w-[54px] items-center justify-center rounded-[11px] active:opacity-60 ${
                      clip.flipH ? "bg-ink text-bg" : "bg-fill text-ink2"
                    }`}
                  >
                    <FlipHIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ flipV: !clip.flipV }, "flipV")}
                    aria-label={t("flipV")}
                    className={`flex h-[46px] w-[54px] items-center justify-center rounded-[11px] active:opacity-60 ${
                      clip.flipV ? "bg-ink text-bg" : "bg-fill text-ink2"
                    }`}
                  >
                    <FlipVIcon size={18} />
                  </button>
                </div>
              </Panel>
            </section>
          )}

          {isText && clip.text && (
            <section>
              <SectionLabel>{t("textContent")}</SectionLabel>
              <Panel>
                <textarea
                  value={clip.text.content}
                  onChange={(event) =>
                    patch(
                      { text: { ...clip.text!, content: event.target.value } },
                      "textContent",
                    )
                  }
                  rows={3}
                  className="w-full resize-none rounded-[10px] bg-fill px-3 py-2.5 text-[14px] leading-[1.4] outline-none"
                  placeholder={t("textContent")}
                />
                <div className="mt-2">
                  <Slider
                    label={t("size")}
                    display={String(clip.text.size)}
                    min={18}
                    max={96}
                    step={2}
                    value={clip.text.size}
                    onChange={(value) =>
                      patch({ text: { ...clip.text!, size: value } }, "textSize")
                    }
                  />
                  <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-[10px] bg-fill p-1">
                    {(["left", "center", "right"] as TextAlign[]).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() =>
                          patch({ text: { ...clip.text!, align } }, "textAlign")
                        }
                        className={`rounded-[8px] py-2 text-[12px] font-medium ${
                          clip.text!.align === align
                            ? "bg-card text-ink shadow-[var(--shadow-card)]"
                            : "text-ink2"
                        }`}
                      >
                        {t(align)}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-[10px] bg-fill p-1">
                    {(["bottom", "center", "top"] as TextVAlign[]).map((vAlign) => (
                      <button
                        key={vAlign}
                        type="button"
                        onClick={() =>
                          patch({ text: { ...clip.text!, vAlign } }, "textVAlign")
                        }
                        className={`rounded-[8px] py-2 text-[12px] font-medium ${
                          (clip.text!.vAlign ?? "center") === vAlign
                            ? "bg-card text-ink shadow-[var(--shadow-card)]"
                            : "text-ink2"
                        }`}
                      >
                        {t(vAlign)}
                      </button>
                    ))}
                  </div>

                  <p className="mt-3 mb-1.5 text-[11.5px] text-ink3">{t("font")}</p>
                  <div className="grid grid-cols-3 gap-1.5 rounded-[10px] bg-fill p-1">
                    {fontOptions.map((font) => (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() =>
                          patch({ text: { ...clip.text!, font: font.id } }, "textFont")
                        }
                        className={`rounded-[8px] px-1 py-2 text-[11.5px] font-medium ${
                          clip.text!.font === font.id
                            ? "bg-card text-ink shadow-[var(--shadow-card)]"
                            : "text-ink2"
                        }`}
                      >
                        {font.label}
                      </button>
                    ))}
                  </div>

                  <p className="mt-3 mb-1.5 text-[11.5px] text-ink3">{t("color")}</p>
                  <div className="flex flex-wrap gap-2">
                    {TEXT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          patch({ text: { ...clip.text!, color } }, "textColor")
                        }
                        aria-label={`${t("color")} ${color}`}
                        className={`h-7 w-7 rounded-full border active:scale-90 ${
                          clip.text!.color === color
                            ? "border-ink ring-2 ring-ink/25"
                            : "border-line"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <p className="mt-3 mb-1.5 text-[11.5px] text-ink3">{t("animIn")}</p>
                  <div className="grid grid-cols-4 gap-1 rounded-[10px] bg-fill p-1">
                    {ANIMS.map((anim) => (
                      <button
                        key={anim}
                        type="button"
                        onClick={() =>
                          patch({ text: { ...clip.text!, animIn: anim } }, "animIn")
                        }
                        className={`rounded-[8px] px-1 py-2 text-[10.5px] font-medium ${
                          clip.text!.animIn === anim
                            ? "bg-card text-ink shadow-[var(--shadow-card)]"
                            : "text-ink2"
                        }`}
                      >
                        {t(anim)}
                      </button>
                    ))}
                  </div>

                  <p className="mt-3 mb-1.5 text-[11.5px] text-ink3">{t("animOut")}</p>
                  <div className="grid grid-cols-4 gap-1 rounded-[10px] bg-fill p-1">
                    {ANIMS.map((anim) => (
                      <button
                        key={anim}
                        type="button"
                        onClick={() =>
                          patch({ text: { ...clip.text!, animOut: anim } }, "animOut")
                        }
                        className={`rounded-[8px] px-1 py-2 text-[10.5px] font-medium ${
                          clip.text!.animOut === anim
                            ? "bg-card text-ink shadow-[var(--shadow-card)]"
                            : "text-ink2"
                        }`}
                      >
                        {t(anim)}
                      </button>
                    ))}
                  </div>
                </div>
              </Panel>
            </section>
          )}
        </>
      )}

      {(packMusic.length > 0 || packStickers.length > 0) && (
        <PackMediaPanel
          music={packMusic}
          stickers={packStickers}
          onAddMusic={onAddPackMusic}
          onAddSticker={onAddSticker}
        />
      )}
    </div>
  );
}
