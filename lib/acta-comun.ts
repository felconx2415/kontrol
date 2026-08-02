import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

/**
 * Piezas compartidas por las actas en PDF de bodega.
 *
 * Existen tres documentos con la misma identidad visual (entrega de una
 * solicitud, préstamo y asignación) y las mismas primitivas: una hoja A4 con
 * márgenes iguales, texto envuelto a mano —pdf-lib no lo hace solo— y bloques
 * de firma. Vivían duplicadas; al aparecer el tercero se volvieron un módulo.
 */

export const MARGEN = 50;
export const NEGRO = rgb(0.06, 0.09, 0.16);
export const GRIS = rgb(0.45, 0.5, 0.56);
export const LINEA = rgb(0.85, 0.87, 0.9);
export const ANCHO = 595;
export const ALTO = 842; // A4

/**
 * Alto que ocupa una firma por encima de su línea. El dibujo crece hacia
 * arriba, así que quien la coloca debe dejar al menos este hueco libre o el
 * trazo se monta sobre el texto anterior.
 */
export const ALTO_FIRMA = 66;

/** Envuelve texto a mano: pdf-lib no lo hace solo. */
export function envolver(
  texto: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  anchoMax: number,
): string[] {
  const palabras = texto.split(/\s+/);
  const renglones: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const tentativo = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(tentativo, size) > anchoMax && actual) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = tentativo;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

/** Dibuja una firma (o un espacio en blanco) con su línea y nombre debajo. */
export async function bloqueFirma(
  pdf: PDFDocument,
  pagina: PDFPage,
  firmaPng: Uint8Array | null,
  x: number,
  yBase: number,
  titulo: string,
  nombre: string,
) {
  const ancho = 200;
  if (firmaPng) {
    try {
      const firma = await pdf.embedPng(firmaPng);
      const escala = Math.min(180 / firma.width, 60 / firma.height);
      pagina.drawImage(firma, {
        x,
        y: yBase + 6,
        width: firma.width * escala,
        height: firma.height * escala,
      });
    } catch {
      // firma ilegible: se deja el espacio en blanco.
    }
  }
  pagina.drawLine({
    start: { x, y: yBase },
    end: { x: x + ancho, y: yBase },
    thickness: 0.75,
    color: NEGRO,
  });
  pagina.drawText(nombre, {
    x,
    y: yBase - 14,
    size: 9,
    font: await pdf.embedFont(StandardFonts.HelveticaBold),
    color: NEGRO,
  });
  pagina.drawText(titulo, {
    x,
    y: yBase - 26,
    size: 8,
    font: await pdf.embedFont(StandardFonts.Helvetica),
    color: GRIS,
  });
}
