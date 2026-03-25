import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function normalizePngDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  let base64 = dataUrl;
  if (dataUrl.startsWith("data:")) {
    const idx = dataUrl.indexOf(",");
    base64 = idx >= 0 ? dataUrl.slice(idx + 1) : "";
  }
  try {
    const buf = Buffer.from(base64, "base64");
    if (!buf || buf.length === 0) return null;
    return new Uint8Array(buf);
  } catch (_) {
    return null;
  }
}

function drawTextAligned(page, text, opts) {
  const { x, y, width, font, size, color, align } = opts;
  const safeText = (text ?? "").toString();
  const tw = font.widthOfTextAtSize(safeText, size);
  let tx = x;
  if (align === "center") tx = x + Math.max(0, (width - tw) / 2);
  else if (align === "right") tx = x + Math.max(0, width - tw);
  page.drawText(safeText, { x: tx, y, size, font, color });
}

function buildIdLabel(meta) {
  if (!meta) return null;
  const sanitize = (value) => {
    if (value === null || value === undefined) return '';
    const str = value.toString().trim();
    if (!str || str === '-' || str === '--') return '';
    return str;
  };
  const status = sanitize(meta.status).toUpperCase();
  const primaryId = sanitize(meta.id);
  const nipValue = sanitize(meta.nip);
  const nimValue = sanitize(meta.nim);
  if (status === 'STAF' && primaryId) return `NIP. ${primaryId}`;
  if (status === 'MAHASISWA' && primaryId) return `NIM. ${primaryId}`;
  if (status === 'STAF' && nipValue) return `NIP. ${nipValue}`;
  if (status === 'MAHASISWA' && nimValue) return `NIM. ${nimValue}`;
  if (nipValue) return `NIP. ${nipValue}`;
  if (nimValue) return `NIM. ${nimValue}`;
  if (primaryId) return primaryId;
  const fallback = sanitize(meta.idLabel || meta.label || meta.identifier || meta.idText);
  return fallback || null;
}
async function drawSignatureImageOrPlaceholder(doc, page, bytes, box, fonts) {
  const maxW = Math.min(220, box.width);
  const maxH = Math.min(70, box.height);
  if (bytes && bytes.byteLength > 0 && maxH > 0 && maxW > 0) {
    const png = await doc.embedPng(bytes);
    const pngW = png.width;
    const pngH = png.height;
    const scale = Math.min(maxW / pngW, maxH / pngH, 1);
    const w = pngW * scale;
    const h = pngH * scale;
    const cx = box.x + (box.width - w) / 2;
    const cy = box.y;
    if (w > 0 && h > 0) page.drawImage(png, { x: cx, y: cy, width: w, height: h });
    return { width: w, height: h };
  }

  const w = Math.min(180, box.width);
  const h = Math.min(70, Math.max(0, box.height));
  const px = box.x + (box.width - w) / 2;
  const py = box.y;
  if (h > 0 && w > 0) {
    page.drawRectangle({ x: px, y: py, width: w, height: h, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 1, borderDashArray: [4, 3] });
    const label = "(Tanda Tangan)";
    const size = 11;
    const tw = fonts.bold.widthOfTextAtSize(label, size);
    const tx = px + Math.max(0, (w - tw) / 2);
    const ty = py + Math.max(0, (h - size) / 2);
    page.drawText(label, { x: tx, y: ty, size, font: fonts.bold, color: rgb(0.4, 0.4, 0.4) });
  }
  return { width: w, height: h };
}

export async function renderSignaturesOnPdf(pdfBytes, leftSigDataUrl, rightSigDataUrl, meta) {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  if (!pages || pages.length === 0) return new Uint8Array(await doc.save());

  const page = pages[pages.length - 1];
  const { width } = page.getSize();

  const fontNormal = await doc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fonts = { normal: fontNormal, bold: fontBold };

  const margin = 56;
  const gutter = 32;
  const areaHeight = 190;
  // helper: convert millimeters to PDF points (1pt = 1/72 inch, 1in = 25.4mm)
  const mmToPt = (mm) => (mm * 72) / 25.4;
  const colWidth = (width - 2 * margin - gutter) / 2;
  const xLeft = margin;
  const xRight = margin + colWidth + gutter;

  // The template reserves a 32mm bottom margin for the footer; use precise conversion
  const footerHeightGuess = Math.round(mmToPt(32)); // ~90.7pt
  const safePad = 8;
  // add a small extra bottom gap so signatures don't hug the footer
  const extraBottom = Math.round(mmToPt(6)); // ~17pt
  const bottomY = Math.max(margin, footerHeightGuess + safePad + extraBottom);
  const topY = bottomY + areaHeight;

  const sizeNormal = 13;
  const sizeBold = 13;
  const lineGap = 3;
  const lineH = sizeNormal + lineGap;

  const leftPng = normalizePngDataUrl(leftSigDataUrl);
  const rightPng = normalizePngDataUrl(rightSigDataUrl);
  const leftMeta = meta && meta.left ? meta.left : { heading: 'Penanggungjawab,', subheading: '', name: '', id: '' };
  const rightMeta = meta && meta.right ? meta.right : { heading: 'Mahasiswa,', dateText: '', name: '', id: '' };

  const renderColumn = async (side) => {
    const x = side === 'left' ? xLeft : xRight;
    const m = side === 'left' ? leftMeta : rightMeta;
    let y = bottomY;

    const idLabel = buildIdLabel(m);
    if (idLabel) {
      drawTextAligned(page, idLabel, { x, y, width: colWidth, font: fontBold, size: sizeNormal, color: rgb(0,0,0), align: 'center' });
      y += lineH;
    }
    drawTextAligned(page, (m.name ?? '').toString(), { x, y, width: colWidth, font: fontBold, size: sizeBold, color: rgb(0,0,0), align: 'center' });
    y += lineH;

    const hasSubRight = !!(rightMeta.subheading && rightMeta.subheading.trim());
    const row2H = side === 'left' ? lineH : (hasSubRight ? lineH : 7);
    const reservedAbove = 16 + row2H + lineH; 
    const avail = Math.max(0, topY - y - reservedAbove);
    const imgH = Math.max(0, Math.min(70, avail));
    const used = await drawSignatureImageOrPlaceholder(doc, page, side === 'left' ? leftPng : rightPng, { x, y, width: colWidth, height: imgH }, fonts);
    y += used.height;

    y += 16;

    if (side === 'left') {
      drawTextAligned(page, (m.subheading ?? '').toString(), { x, y, width: colWidth, font: fontBold, size: sizeNormal, color: rgb(0,0,0), align: 'center' });
      y += lineH;
    } else {
      if (hasSubRight) {
        drawTextAligned(page, (m.subheading ?? '').toString(), { x, y, width: colWidth, font: fontBold, size: sizeNormal, color: rgb(0,0,0), align: 'right' });
        y += lineH;
      } else {
        y += 7;
      }
    }

    if (side === 'left') {
      drawTextAligned(page, (m.heading ?? 'Penanggungjawab,').toString(), { x, y, width: colWidth, font: fontBold, size: sizeNormal, color: rgb(0,0,0), align: 'center' });
    } else {
      const dateLine = `${m.heading ?? 'Mahasiswa,'} ${m.dateText ?? ''}`.trim();
      drawTextAligned(page, dateLine, { x, y, width: colWidth, font: fontBold, size: sizeNormal, color: rgb(0,0,0), align: 'center' });
    }
  };

  await Promise.all([renderColumn('left'), renderColumn('right')]);

  const out = await doc.save();
  return new Uint8Array(out);
}

export default { renderSignaturesOnPdf };