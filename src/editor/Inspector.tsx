import { Button, Slider, Toggle } from "@/components/ui";
import {
  CopyIcon,
  FlipHIcon,
  FlipVIcon,
  LayersIcon,
  MusicIcon,
  PlusIcon,
  RotateIcon,
  ScissorsIcon,
  TextIcon,
  TrashBinIcon,
  UndoIcon,
  RedoIcon,
} from "@/components/Icons";
import { formatBytes, formatDuration } from "@/lib/files";
import type { Entry } from "@/lib/library";
import type { Clip, Project, TextAlign, TrackKind } from "./types";
import { ASPECTS, SPEED_MAX, SPEED_MIN } from "./types";
import { useEditorT } from "./labels";

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
}) {
  const t = useEditorT();
  const isText = clip?.kind === "text";
  const hasAudio = clip?.kind === "video" || clip?.kind === "audio";

  const patch = (value: Partial<Clip>, key: string) => {
    if (!clip) return;
    onPatchClip(clip.id, value, `${clip.id}:${key}`);
  };

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
            </div>
          </div>

          {hasAudio && (
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
                </div>
              </Panel>
            </section>
          )}
        </>
      )}
    </div>
  );
}
