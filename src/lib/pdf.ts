import type { PDFFont, PDFDocument } from "pdf-lib";

const BASE = import.meta.env?.BASE_URL ?? "/";

/**
 * PDF metinleri için gömülü yazı tipi (DejaVu Sans, Bitstream Vera /
 * public domain lisanslı). Dosya indirilemezse Helvetica'ya düşülür ve
 * WinAnsi'de olmayan karakterler sadeleştirilir.
 */
export type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
  embedded: boolean;
};

async function fetchFont(name: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(`${BASE}fonts/${name}`);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return buffer.byteLength > 0 ? buffer : null;
  } catch {
    return null;
  }
}

/** WinAnsi (Helvetica) desteklemeyen karakterleri okunur karşılığına çevirir. */
const WINANSI_FALLBACK: Record<string, string> = {
  ğ: "g", Ğ: "G", ı: "i", İ: "I", ş: "s", Ş: "S",
  "–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"',
  "…": "...", "•": "-", " ": " ",
};

export function sanitizeForWinAnsi(text: string): string {
  return text.replace(/[ğĞışŞ–—‘’“”…•\u00A0]/g, (char) => WINANSI_FALLBACK[char] ?? " ");
}

export async function createPdfDoc(): Promise<{
  doc: PDFDocument;
  fonts: PdfFonts;
}> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();

  const [regularBytes, boldBytes] = await Promise.all([
    fetchFont("DejaVuSans.ttf"),
    fetchFont("DejaVuSans-Bold.ttf"),
  ]);

  if (regularBytes) {
    try {
      const fontkit = (await import("@pdf-lib/fontkit")).default;
      doc.registerFontkit(fontkit);
      const regular = await doc.embedFont(regularBytes, { subset: true });
      const bold = boldBytes
        ? await doc.embedFont(boldBytes, { subset: true })
        : regular;
      return { doc, fonts: { regular, bold, embedded: true } };
    } catch {
      // Gömme başarısızsa yedek yazı tipine düşülür.
    }
  }

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, fonts: { regular, bold, embedded: false } };
}

/** Yazı tipiyle uyumsuz metni güvenli hâle getirir (yalnız yedek fontta). */
export function prepareText(text: string, fonts: PdfFonts): string {
  return fonts.embedded ? text : sanitizeForWinAnsi(text);
}

function safeWidth(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    // Desteklenmeyen glif: karakter başına ortalama genişlikle tahmin et.
    return text.length * size * 0.55;
  }
}

/** Uzun satırları kelime kelime taşır; kelime tek başına taşarsa böler. */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || safeWidth(font, candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
      if (safeWidth(font, line, size) > maxWidth) {
        // Tek kelime sayfadan genişse karakterlerde böl.
        let chunk = "";
        for (const char of line) {
          if (safeWidth(font, chunk + char, size) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        line = chunk;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Desteklenmeyen görsel biçimlerini (GIF, WebP, EMF…) PNG'ye çevirir.
 * PNG/JPEG doğrudan geçer; çevirilemezse null döner.
 */
export async function imageToPng(
  data: Uint8Array,
  mime: string,
): Promise<Uint8Array | null> {
  const normalized = mime.toLowerCase();
  if (normalized === "image/png" || normalized === "image/jpeg") return data;
  try {
    const source = new Blob([data as unknown as BlobPart], { type: mime });
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!png) return null;
    return new Uint8Array(await png.arrayBuffer());
  } catch {
    return null;
  }
}
