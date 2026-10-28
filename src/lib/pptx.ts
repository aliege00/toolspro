import { unzipSync, strFromU8 } from "fflate";

/**
 * PPTX (Office Open XML) sunumlarını çözümleyip sayfa metriğiyle birlikte
 * metin ve görselleri çıkarır. Amaç: yaklaşık ama yatay/dikey konumu
 * koruyan bir PDF aktarımı — birebir görsel yeniden üretim değil.
 */

const EMU_PER_PT = 12700;

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
} as const;

export type PptxRun = {
  text: string;
  size: number;
  bold: boolean;
  color: string | null;
};

export type PptxParagraph = {
  align: "left" | "center" | "right";
  runs: PptxRun[];
};

export type PptxItem =
  | {
      kind: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      anchor: "top" | "middle" | "bottom";
      paragraphs: PptxParagraph[];
    }
  | { kind: "image"; x: number; y: number; w: number; h: number; bytes: Uint8Array; mime: string };

export type PptxSlide = { items: PptxItem[] };

export type PptxDeck = {
  width: number;
  height: number;
  slides: PptxSlide[];
};

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function firstByNs(root: Element | Document, ns: string, local: string): Element | null {
  const found = root.getElementsByTagNameNS(ns, local);
  return found.length > 0 ? found[0] : null;
}

function childrenByNs(root: Element | Document, ns: string, local: string): Element[] {
  return Array.from(root.getElementsByTagNameNS(ns, local));
}

/** `ppt/slides/../media/a.png` gibi göreli yolları paket içi yola çözer. */
function resolveTarget(baseDir: string, target: string): string {
  const parts = `${baseDir}/${target}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

type Rels = Map<string, string>;

function parseRels(files: Record<string, Uint8Array>, relsPath: string): Rels {
  const rels: Rels = new Map();
  const bytes = files[relsPath];
  if (!bytes) return rels;
  const doc = parseXml(strFromU8(bytes));
  for (const rel of Array.from(doc.getElementsByTagNameNS(NS.rel, "Relationship"))) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) rels.set(id, target);
  }
  return rels;
}

function mimeFromName(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

type Xfrm = { x: number; y: number; w: number; h: number };

function readXfrm(element: Element): Xfrm | null {
  const xfrm = firstByNs(element, NS.a, "xfrm");
  if (!xfrm) return null;
  const off = firstByNs(xfrm, NS.a, "off");
  const ext = firstByNs(xfrm, NS.a, "ext");
  if (!off || !ext) return null;
  const x = Number(off.getAttribute("x"));
  const y = Number(off.getAttribute("y"));
  const w = Number(ext.getAttribute("cx"));
  const h = Number(ext.getAttribute("cy"));
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { x: x / EMU_PER_PT, y: y / EMU_PER_PT, w: w / EMU_PER_PT, h: h / EMU_PER_PT };
}

/** Placeholder şekli şablondan (layout) konumunu miras alır. */
function layoutXfrm(
  shape: Element,
  slideFiles: Record<string, Uint8Array>,
  slideDir: string,
  slideRels: Rels,
  layoutCache: Map<string, { doc: Document; rels: Rels }>,
): Xfrm | null {
  const ph = firstByNs(shape, NS.p, "ph");
  if (!ph) return null;
  const layoutTarget = [...slideRels.values()].find((target) =>
    /slideLayout\d*\.xml$/.test(target),
  );
  if (!layoutTarget) return null;
  const layoutPath = resolveTarget(slideDir, layoutTarget);
  let layout = layoutCache.get(layoutPath);
  if (!layout) {
    const bytes = slideFiles[layoutPath];
    if (!bytes) return null;
    const relsPath = layoutPath.replace(/[^/]+$/, (name) => `_rels/${name}.rels`);
    layout = {
      doc: parseXml(strFromU8(bytes)),
      rels: parseRels(slideFiles, relsPath),
    };
    layoutCache.set(layoutPath, layout);
  }

  const idx = ph.getAttribute("idx");
  const type = ph.getAttribute("type") ?? "";
  const candidates = childrenByNs(layout.doc, NS.p, "sp");
  for (const candidate of candidates) {
    const candidatePh = firstByNs(candidate, NS.p, "ph");
    if (!candidatePh) continue;
    const candidateIdx = candidatePh.getAttribute("idx");
    const candidateType = candidatePh.getAttribute("type") ?? "";
    const match =
      (idx !== null && candidateIdx === idx) ||
      (idx === null && candidateType && candidateType === type);
    if (match) {
      const xfrm = readXfrm(candidate);
      if (xfrm) return xfrm;
    }
  }
  return null;
}

/** Şekilleri belgedeki sırayla (z-sırası korunarak) toplar; gruplanan öğeler dahil. */
function collectShapes(root: Element): Element[] {
  const shapes: Element[] = [];
  const children = Array.from(root.childNodes).filter(
    (node) => node.nodeType === 1,
  ) as Element[];
  for (const child of children) {
    if (child.localName === "sp" || child.localName === "pic") {
      shapes.push(child);
    } else if (child.localName === "spTree" || child.localName === "grpSp") {
      shapes.push(...collectShapes(child));
    }
  }
  return shapes;
}

function readParagraph(paragraph: Element): PptxParagraph | null {
  const pPr = firstByNs(paragraph, NS.a, "pPr");
  const algn = pPr?.getAttribute("algn") ?? "l";
  const align: PptxParagraph["align"] =
    algn === "ctr" ? "center" : algn === "r" ? "right" : "left";

  const runs: PptxRun[] = [];
  const children = Array.from(paragraph.childNodes).filter(
    (node) => node.nodeType === 1,
  ) as Element[];
  for (const child of children) {
    const local = child.localName;
    if (local === "br") {
      runs.push({ text: "\n", size: 18, bold: false, color: null });
      continue;
    }
    if (local !== "r" && local !== "fld") continue;
    const text = firstByNs(child, NS.a, "t")?.textContent ?? "";
    if (!text) continue;
    const rPr = firstByNs(child, NS.a, "rPr");
    const sizeRaw = rPr?.getAttribute("sz");
    const size = sizeRaw ? Number(sizeRaw) / 100 : 18;
    const bold = rPr?.getAttribute("b") === "1";
    const color = firstByNs(rPr ?? child, NS.a, "srgbClr")?.getAttribute("val") ?? null;
    runs.push({
      text,
      size: Number.isFinite(size) && size > 0 ? size : 18,
      bold,
      color,
    });
  }

  if (runs.length === 0) return null;
  return { align, runs };
}

function readShapeText(element: Element): PptxParagraph[] {
  const body = firstByNs(element, NS.p, "txBody");
  if (!body) return [];
  const paragraphs: PptxParagraph[] = [];
  for (const paragraph of childrenByNs(body, NS.a, "p")) {
    const parsed = readParagraph(paragraph);
    if (parsed) paragraphs.push(parsed);
  }
  return paragraphs;
}

function readAnchor(element: Element): "top" | "middle" | "bottom" {
  const body = firstByNs(element, NS.p, "txBody");
  const bodyPr = body ? firstByNs(body, NS.a, "bodyPr") : null;
  const anchor = bodyPr?.getAttribute("anchor");
  if (anchor === "ctr") return "middle";
  if (anchor === "b") return "bottom";
  return "top";
}

export async function parsePptx(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<PptxDeck> {
  const data = new Uint8Array(await file.arrayBuffer());
  onProgress?.(0.15);
  const files = unzipSync(data);
  onProgress?.(0.35);

  const presentation = files["ppt/presentation.xml"];
  if (!presentation) throw new Error("PPTX_OKUNAMADI");
  const presentationDoc = parseXml(strFromU8(presentation));
  const sldSz = firstByNs(presentationDoc, NS.p, "sldSz");
  const cx = Number(sldSz?.getAttribute("cx") ?? 0);
  const cy = Number(sldSz?.getAttribute("cy") ?? 0);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || cx <= 0 || cy <= 0) {
    throw new Error("PPTX_OKUNAMADI");
  }

  const slidePaths = Object.keys(files)
    .map((path) => ({ path, match: path.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((entry): entry is { path: string; match: RegExpMatchArray } => !!entry.match)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .map((entry) => entry.path);

  if (slidePaths.length === 0) throw new Error("PPTX_SLIDE_YOK");

  const layoutCache = new Map<string, { doc: Document; rels: Rels }>();
  const slides: PptxSlide[] = [];
  const width = cx / EMU_PER_PT;
  const height = cy / EMU_PER_PT;

  for (let index = 0; index < slidePaths.length; index += 1) {
    const path = slidePaths[index];
    const slideDir = path.replace(/[^/]+$/, "");
    const relsPath = path.replace(/[^/]+$/, (name) => `_rels/${name}.rels`);
    const rels = parseRels(files, relsPath);
    const doc = parseXml(strFromU8(files[path]));
    const items: PptxItem[] = [];

    const spTree = firstByNs(doc, NS.p, "spTree");
    const shapes = spTree
      ? collectShapes(spTree)
      : [...childrenByNs(doc, NS.p, "sp"), ...childrenByNs(doc, NS.p, "pic")];

    for (const shape of shapes) {
      const local = shape.localName;
      let xfrm = readXfrm(shape);
      if (!xfrm) {
        xfrm = layoutXfrm(shape, files, slideDir, rels, layoutCache);
      }

      if (local === "pic") {
        if (!xfrm) continue;
        const blip = firstByNs(shape, NS.a, "blip");
        const embedId = blip?.getAttributeNS(NS.r, "embed");
        const target = embedId ? rels.get(embedId) : null;
        if (!target) continue;
        const mediaPath = resolveTarget(slideDir, target);
        const bytes = files[mediaPath];
        if (!bytes) continue;
        items.push({
          kind: "image",
          x: xfrm.x,
          y: xfrm.y,
          w: xfrm.w,
          h: xfrm.h,
          bytes,
          mime: mimeFromName(mediaPath),
        });
        continue;
      }

      const paragraphs = readShapeText(shape);
      if (paragraphs.length === 0) continue;
      const anchor = readAnchor(shape);
      if (xfrm) {
        items.push({
          kind: "text",
          x: xfrm.x,
          y: xfrm.y,
          w: xfrm.w,
          h: xfrm.h,
          anchor,
          paragraphs,
        });
      } else {
        // Konumu bilinmeyen metin kutusu: soldan kenar boşluğuyla akışa yerleşir.
        const estimatedHeight = paragraphs.length * 34;
        items.push({
          kind: "text",
          x: 36,
          y: 36 + items.filter((item) => item.kind === "text").length * estimatedHeight,
          w: width - 72,
          h: estimatedHeight,
          anchor: "top",
          paragraphs,
        });
      }
    }

    slides.push({ items });
    onProgress?.(0.35 + ((index + 1) / slidePaths.length) * 0.6);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return { width, height, slides };
}
