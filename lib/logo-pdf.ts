import "server-only";

import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { LOGO_ALTO, LOGO_ANCHO, LOGO_PNG_BASE64 } from "@/lib/logo";

/** Incrusta el logotipo una vez por documento; luego se puede dibujar N veces. */
export async function incrustarLogo(pdf: PDFDocument): Promise<PDFImage> {
  return pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
}

/**
 * Dibuja el logotipo anclado por su borde superior (`yTop`), que es como se
 * razona el encabezado de estas páginas: el cursor `y` baja desde el margen.
 * Devuelve el ancho ocupado, para poder poner texto a su derecha.
 */
export function dibujarLogo(
  pagina: PDFPage,
  logo: PDFImage,
  { x, yTop, alto }: { x: number; yTop: number; alto: number },
): number {
  const ancho = (alto * LOGO_ANCHO) / LOGO_ALTO;
  pagina.drawImage(logo, { x, y: yTop - alto, width: ancho, height: alto });
  return ancho;
}
