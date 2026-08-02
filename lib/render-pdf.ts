import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";

/**
 * Convierte HTML en un PDF A4 usando Chromium.
 *
 * Las actas se maquetan en HTML/CSS y no dibujando coordenadas, porque el
 * formato es un documento con tabla que pagina, y sostener eso a mano en
 * pdf-lib cuesta mucho más que escribirlo en CSS. El precio es tener Chromium
 * en la imagen; a cambio, lo que se ve en el navegador es exactamente lo que
 * sale impreso.
 *
 * Todo lo que la página necesita (fuentes, logo, firmas) va incrustado como
 * data URI: `setContent` no resuelve rutas relativas y el contenedor no debe
 * depender de la red para imprimir un acta.
 */

// Un solo navegador para todo el proceso: arrancarlo cuesta ~300 ms y abrir
// una pestaña, casi nada. En desarrollo Next recarga los módulos, así que el
// singleton vive en globalThis para no dejar procesos huérfanos.
const global_ = globalThis as unknown as { navegadorPdf?: Promise<Browser> };

function navegador(): Promise<Browser> {
  if (!global_.navegadorPdf) {
    global_.navegadorPdf = chromium.launch({
      // Dentro del contenedor el proceso corre como root y sin /dev/shm
      // grande; sin estas banderas Chromium no arranca.
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return global_.navegadorPdf;
}

export async function htmlAPdf(html: string): Promise<Uint8Array> {
  const pagina = await (await navegador()).newPage();
  try {
    await pagina.setContent(html, { waitUntil: "load" });
    // Sin esto el PDF puede salir con la tipografía de reserva: las webfonts
    // se aplican después del evento load.
    await pagina.evaluate(() => document.fonts.ready);
    const pdf = await pagina.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return new Uint8Array(pdf);
  } finally {
    await pagina.close();
  }
}

/** Las fuentes se leen una vez y se reutilizan en cada acta. */
const fuentesCache = new Map<string, string>();

export async function fuenteBase64(archivo: string): Promise<string> {
  const cacheada = fuentesCache.get(archivo);
  if (cacheada) return cacheada;
  const bytes = await readFile(
    path.join(process.cwd(), "public", "fuentes", archivo),
  );
  const base64 = bytes.toString("base64");
  fuentesCache.set(archivo, base64);
  return base64;
}

/** Lee una imagen subida (/uploads/…) como data URI, o null si no está. */
export async function subidaComoDataUri(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith("/uploads/")) return null;
  try {
    // Normaliza para no salir de public/ (evita rutas con «..»).
    const relativa = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
    const bytes = await readFile(path.join(process.cwd(), "public", relativa));
    const ext = relativa.toLowerCase();
    const tipo = ext.endsWith(".png")
      ? "image/png"
      : ext.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return `data:${tipo};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
