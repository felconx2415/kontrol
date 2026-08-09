import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { alcanza } from "@/lib/alcance";
import { origenPublico } from "@/lib/origen";
import { actaDeEntrega } from "@/lib/actas/generar";
import { formatearFolio } from "@/lib/folio";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entregaId: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { entregaId } = await params;

  const entrega = await db.entrega.findUnique({
    where: { id: entregaId },
    select: {
      receptorId: true,
      solicitud: { select: { folio: true, empresaId: true } },
    },
  });

  if (!entrega) {
    return NextResponse.json({ error: "Acta no encontrada." }, { status: 404 });
  }

  // Un solicitante solo puede descargar su propia acta.
  if (usuario.rol === "SOLICITANTE" && entrega.receptorId !== usuario.id) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  // Y nadie descarga el acta de otra empresa, salvo el destinatario la suya.
  if (
    entrega.receptorId !== usuario.id &&
    !alcanza(usuario.alcance, entrega.solicitud.empresaId)
  ) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const pdf = await actaDeEntrega(entregaId, origenPublico(request));
  if (!pdf) {
    return NextResponse.json({ error: "Acta no encontrada." }, { status: 404 });
  }

  const nombreArchivo = `acta-${formatearFolio(entrega.solicitud.folio)}.pdf`;

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombreArchivo}"`,
    },
  });
}
