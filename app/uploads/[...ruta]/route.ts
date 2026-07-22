import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RAIZ_SUBIDAS } from "@/lib/archivos";

/**
 * Sirve los archivos subidos en tiempo de ejecución (firmas, fotos).
 *
 * Necesario porque `next start` NO sirve archivos agregados a `public/` después
 * del build: solo los que existían al compilar. Como las firmas y fotos se
 * suben mientras la app corre, quedaban en 404. Este handler los lee del disco
 * en cada petición y los devuelve.
 */
const TIPOS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ruta: string[] }> },
) {
  const { ruta } = await params;

  // Normaliza y bloquea traversal fuera de la carpeta de subidas.
  const relativa = path
    .normalize(ruta.join("/"))
    .replace(/^(\.\.[/\\])+/, "");
  const completa = path.join(RAIZ_SUBIDAS, relativa);
  if (!completa.startsWith(RAIZ_SUBIDAS)) {
    return new NextResponse("Ruta inválida", { status: 400 });
  }

  try {
    const datos = await readFile(completa);
    const ext = path.extname(completa).toLowerCase();
    return new NextResponse(new Uint8Array(datos), {
      headers: {
        "Content-Type": TIPOS[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
