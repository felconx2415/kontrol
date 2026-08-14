import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { alcanza } from "@/lib/alcance";
import { origenPublico } from "@/lib/origen";
import { esGestion } from "@/lib/solicitud-estado";
import { actaDeAsignacion } from "@/lib/actas/generar";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

  const acta = await actaDeAsignacion(id, origenPublico(request));
  if (!acta) {
    return NextResponse.json({ error: "La asignación no existe." }, { status: 404 });
  }

  // Gestión ve cualquier acta; el resto, solo la de su propio equipamiento.
  if (!esGestion(usuario.rol) && acta.usuarioId !== usuario.id) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const asignacion = await db.asignacionBodega.findUnique({
    where: { id },
    select: {
      items: { select: { item: { select: { empresaId: true } } } },
    },
  });

  // Gestión tampoco alcanza la bodega de otra empresa; el dueño del
  // equipamiento sí conserva su acta. La entrega llega a la empresa por los
  // ítems que salieron de bodega.
  if (
    acta.usuarioId !== usuario.id &&
    !(asignacion?.items ?? []).some((l) => alcanza(usuario.alcance, l.item.empresaId))
  ) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const nombreArchivo = `acta-entrega-bodega-${id.slice(-6).toLowerCase()}.pdf`;

  return new NextResponse(acta.pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
