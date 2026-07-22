import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { esGestion } from "@/lib/solicitud-estado";
import {
  generarActaPrestamoPdf,
  type FotoActa,
} from "@/lib/acta-prestamo-pdf";

/** Lee un archivo público (/uploads/…) y lo devuelve como bytes, o null. */
async function leerSubida(url: string | null): Promise<Uint8Array | null> {
  if (!url || !url.startsWith("/uploads/")) return null;
  try {
    // Normaliza para no salir de public/ (evita rutas con «..»).
    const relativa = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
    const buffer = await readFile(path.join(process.cwd(), "public", relativa));
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario || !esGestion(usuario.rol)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const { id } = await params;

  const prestamo = await db.prestamo.findUnique({
    where: { id },
    include: {
      item: { select: { codigo: true, nombre: true, unidad: true } },
      prestadoPor: { select: { nombre: true } },
    },
  });
  if (!prestamo) {
    return NextResponse.json({ error: "El préstamo no existe." }, { status: 404 });
  }

  const [firmaSalidaPng, firmaDevolucionPng] = await Promise.all([
    leerSubida(prestamo.firmaSalidaUrl),
    leerSubida(prestamo.firmaDevolucionUrl),
  ]);

  // Fotos de daños: se leen del disco y se detecta el formato por extensión
  // (pdf-lib solo incrusta PNG/JPG; los WEBP se omiten en el acta).
  let urls: string[] = [];
  try {
    const leido = JSON.parse(prestamo.fotosDevolucion ?? "[]");
    if (Array.isArray(leido)) urls = leido.filter((u) => typeof u === "string");
  } catch {
    urls = [];
  }

  const fotos: FotoActa[] = [];
  for (const url of urls) {
    const bytes = await leerSubida(url);
    if (!bytes) continue;
    const ext = url.toLowerCase();
    if (ext.endsWith(".png")) fotos.push({ bytes, tipo: "png" });
    else if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) fotos.push({ bytes, tipo: "jpg" });
    // otros formatos (webp) no son incrustables: se omiten.
  }

  const pdf = await generarActaPrestamoPdf({
    itemCodigo: prestamo.item.codigo,
    itemNombre: prestamo.item.nombre,
    cantidad: prestamo.cantidad,
    unidad: prestamo.item.unidad,
    persona: prestamo.persona,
    prestadoPorNombre: prestamo.prestadoPor.nombre,
    prestadoEn: prestamo.prestadoEn,
    notas: prestamo.notas,
    devueltoEn: prestamo.devueltoEn,
    observacionesDevolucion: prestamo.observacionesDevolucion,
    firmaSalidaPng,
    firmaDevolucionPng,
    fotos,
  });

  const nombreArchivo = `acta-prestamo-${prestamo.item.codigo}-${prestamo.id.slice(0, 6)}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombreArchivo}"`,
    },
  });
}
