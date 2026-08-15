import type { Extintor, EmpresaData } from "../types";
import QRCode from "qrcode";

export interface StickerData {
  empresa_receptora: string;
  fecha_fab: string;
  ultimo_ph: string;
  proximo_ph: string;
  fecha_venc: string;
  serie: string;
  capacidad: string;
  marca: string;
}

const TEMPLATE_URL = "/templates/vencimiento_extintor.svg";
let cachedTemplate: string | null = null;

export const loadStickerTemplate = async (): Promise<string> => {
  if (cachedTemplate) return cachedTemplate;
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error("No se pudo cargar la plantilla de sticker (public/templates/vencimiento_extintor.svg)");
  cachedTemplate = await res.text();
  return cachedTemplate;
};

const escapeXml = (str: string) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const fillStickerTemplate = (template: string, data: StickerData): string => {
  let svg = template;
  (Object.keys(data) as (keyof StickerData)[]).forEach((key) => {
    const value = (data[key] || "").toString();
    svg = svg.split(`{{${key}}}`).join(escapeXml(value));
  });
  return svg;
};

export const embedQrInTemplate = async (svgString: string, valorQr: string): Promise<string> => {
  const qrSvgMarkup = await QRCode.toString(valorQr, {
    type: "svg",
    margin: 1,
    color: { dark: "#000000", light: "#00000000" },
  });

  const viewBoxMatch = qrSvgMarkup.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 100 100";

  const innerMatch = qrSvgMarkup.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const qrInner = innerMatch ? innerMatch[1] : "";

  const placeholderRegex = /<([a-zA-Z]+)([^>]*\bid="qr-placeholder"[^>]*)\/?>(?:<\/\1>)?/;
  const match = svgString.match(placeholderRegex);
  if (!match) return svgString;

  const attrs = match[2];
  const x = (attrs.match(/x="([\d.]+)"/) || [])[1] || "0";
  const y = (attrs.match(/y="([\d.]+)"/) || [])[1] || "0";
  const width = (attrs.match(/width="([\d.]+)"/) || [])[1] || "150";
  const height = (attrs.match(/height="([\d.]+)"/) || [])[1] || "150";

  const qrGroup = `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${qrInner}</svg>`;
  return svgString.replace(match[0], qrGroup);
};

export const buildStickerData = (ext: Extintor, empresa: EmpresaData, fechaVenc: string): StickerData => ({
  empresa_receptora: empresa.razonSocial || "",
  fecha_fab: ext.fechaFabricacion || "—",
  ultimo_ph: ext.realizadoPH || "—",
  proximo_ph: ext.vencimPH || "—",
  fecha_venc: fechaVenc, // Mes/Año elegido en el modal: es el vencimiento que se reemplaza dinámicamente
  serie: ext.nSerie || "S/N",
  capacidad: ext.peso ? `${ext.peso} ${ext.unidadPeso}` : "—",
  marca: ext.marca || "—",
});

/**
 * Nombre de archivo: "NúmeroSerie - Agente - Peso". Si el nombre ya se usó
 * (series duplicadas o S/N repetidos), se agrega el N° Interno (o el rowIndex
 * como último recurso) entre paréntesis para evitar sobrescribir archivos.
 */
export const buildStickerFileName = (ext: Extintor, usedNames: Set<string>): string => {
  const sanitize = (s: string) => (s || "").toString().trim().replace(/[\\/:*?"<>|]/g, "-");
  const serie = sanitize(ext.nSerie || "S-N");
  const agente = sanitize(ext.agenteExtintor || "SinAgente");
  const peso = sanitize(ext.peso ? `${ext.peso}${ext.unidadPeso}` : "SinPeso");
  const base = `${serie} - ${agente} - ${peso}`;

  const fechaFab = sanitize(ext.fechaFabricacion || "");
  const nInterno = sanitize(ext.nInterno || "");

  // Candidatos de nombre, de menor a mayor cantidad de datos agregados.
  // Se usa el primero que no esté ocupado todavía, para que el nombre siga
  // siendo lo más corto y legible posible mientras no haya conflicto real.
  const candidatos: string[] = [base];
  if (fechaFab) candidatos.push(`${base} (Fab ${fechaFab})`);
  if (nInterno) candidatos.push(`${base} (${nInterno})`);
  if (fechaFab && nInterno) candidatos.push(`${base} (Fab ${fechaFab} - ${nInterno})`);

  let fileName = candidatos.find((c) => !usedNames.has(c));

  // Garantía absoluta de unicidad: el rowIndex es único por fila de la tabla,
  // así que si ningún candidato anterior quedó libre (o no había datos
  // suficientes para diferenciar), se usa como último recurso.
  if (!fileName) {
    fileName = `${base} (#${ext.rowIndex})`;
    let sufijo = 2;
    while (usedNames.has(fileName)) {
      fileName = `${base} (#${ext.rowIndex}-${sufijo})`;
      sufijo++;
    }
  }

  usedNames.add(fileName);
  return fileName;
};

export const svgToPngBlob = (svgString: string, width: number, height: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Las Blob URL (URL.createObjectURL) son poco confiables para cargar SVG en un
    // <img>/Canvas entre navegadores, especialmente con texto en español (tildes/ñ)
    // y referencias internas (<pattern>/<defs>). Un Data URI en base64, codificado
    // correctamente en UTF-8, es el método robusto recomendado para esta conversión.
    let base64Svg: string;
    try {
      base64Svg = btoa(unescape(encodeURIComponent(svgString)));
    } catch (e) {
      reject(new Error("No se pudo codificar el SVG: " + (e as Error).message));
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas no disponible")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob); else reject(new Error("No se pudo generar el PNG"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("No se pudo renderizar el SVG. Verifica que la plantilla en /templates/vencimiento_extintor.svg sea un SVG válido."));
    img.src = `data:image/svg+xml;base64,${base64Svg}`;
  });
};

/**
 * Recorre la lista de extintores seleccionados, genera 1 sticker PNG por cada
 * uno (a partir del template SVG) y descarga todo comprimido en un .zip,
 * dentro de una carpeta con el nombre de la empresa.
 */
export const generateStickersZip = async (
  extintores: Extintor[],
  empresa: EmpresaData,
  fechaVenc: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> => {
  const JSZip = (await import("jszip")).default;
  const template = await loadStickerTemplate();
  const zip = new JSZip();
  const carpetaEmpresa = (empresa.razonSocial || "Empresa").trim().replace(/[\\/:*?"<>|]/g, "-");
  const folder = zip.folder(carpetaEmpresa)!;
  const usedNames = new Set<string>();

  for (let i = 0; i < extintores.length; i++) {
    const ext = extintores[i];
    const data = buildStickerData(ext, empresa, fechaVenc);
    let filledSvg = fillStickerTemplate(template, data);
    const urlQr = `${window.location.origin}/scan/${ext.uid || `pendiente-${ext.rowIndex}`}`;
    filledSvg = await embedQrInTemplate(filledSvg, urlQr);
    const pngBlob = await svgToPngBlob(filledSvg, 1183, 1006);
    const fileName = buildStickerFileName(ext, usedNames);
    folder.file(`${fileName}.png`, pngBlob);
    onProgress?.(i + 1, extintores.length);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Stickers_${carpetaEmpresa}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};