import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp"] as const;
export const TAMANO_MAXIMO = 8 * 1024 * 1024; // 8 MB

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const RAIZ_SUBIDAS = path.join(process.cwd(), "public", "uploads");

/**
 * Guarda un archivo bajo public/uploads/<carpeta> y devuelve la ruta pública.
 * Nota: al ser filesystem local, esto asume despliegue en un servidor propio;
 * en una plataforma efímera habría que cambiar a almacenamiento de objetos.
 */
export async function guardarImagen(
  datos: Buffer,
  tipoMime: string,
  carpeta: "evidencias" | "firmas" | "actas",
): Promise<string> {
  const extension = EXTENSION[tipoMime] ?? "bin";
  const nombre = `${randomUUID()}.${extension}`;
  const destino = path.join(RAIZ_SUBIDAS, carpeta);

  await mkdir(destino, { recursive: true });
  await writeFile(path.join(destino, nombre), datos);

  return `/uploads/${carpeta}/${nombre}`;
}

/** Convierte un data URL "data:image/png;base64,…" en un Buffer. */
export function bufferDesdeDataUrl(dataUrl: string): Buffer | null {
  const coincidencia = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!coincidencia) return null;
  return Buffer.from(coincidencia[1], "base64");
}
