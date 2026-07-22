import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { generarActaPdf } from "@/lib/acta-pdf";
import { formatearFolio } from "@/lib/folio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entregaId: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { entregaId } = await params;

  const entrega = await db.entrega.findUnique({
    where: { id: entregaId },
    include: {
      receptor: { select: { id: true, nombre: true, rut: true } },
      entregadoPor: { select: { nombre: true } },
      solicitud: {
        include: { brigada: { select: { nombre: true } } },
      },
      items: {
        include: {
          solicitudItem: { include: { articulo: true } },
        },
      },
    },
  });

  if (!entrega) {
    return NextResponse.json({ error: "Acta no encontrada." }, { status: 404 });
  }

  // Un solicitante solo puede descargar su propia acta.
  if (usuario.rol === "SOLICITANTE" && entrega.receptorId !== usuario.id) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  // La firma vive en public/uploads; se lee del disco para incrustarla.
  const rutaFirma = path.join(process.cwd(), "public", entrega.firmaPngUrl);
  let firmaPng: Buffer;
  try {
    firmaPng = await readFile(rutaFirma);
  } catch {
    return NextResponse.json(
      { error: "No se encontró la firma asociada a esta entrega." },
      { status: 500 },
    );
  }

  const pdf = await generarActaPdf({
    folio: entrega.solicitud.folio,
    tipo: entrega.solicitud.tipo,
    receptorNombre: entrega.receptor.nombre,
    receptorRut: entrega.receptor.rut,
    brigadaNombre: entrega.solicitud.brigada?.nombre ?? null,
    entregadoPorNombre: entrega.entregadoPor.nombre,
    entregadaEn: entrega.entregadaEn,
    observaciones: entrega.observaciones,
    items: entrega.items.map((i) => ({
      nombre: i.solicitudItem.articulo.nombre,
      codigo: i.solicitudItem.articulo.codigo,
      cantidad: i.cantidadEntregada,
      unidad: i.solicitudItem.articulo.unidad,
      talla: i.solicitudItem.talla,
      venceEn: i.venceEn,
    })),
    firmaPng: new Uint8Array(firmaPng),
  });

  const nombreArchivo = `acta-${formatearFolio(entrega.solicitud.folio)}.pdf`;

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombreArchivo}"`,
    },
  });
}
