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
    select: { item: { select: { codigo: true, empresaId: true } } },
  });

  // Gestión tampoco alcanza la bodega de otra empresa; el dueño del
  // equipamiento sí conserva su acta.
  if (
    acta.usuarioId !== usuario.id &&
    !alcanza(usuario.alcance, asignacion?.item.empresaId ?? null)
  ) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const nombreArchivo = `acta-entrega-${asignacion?.item.codigo ?? "bodega"}-${id.slice(0, 6)}.pdf`;

  return new NextResponse(acta.pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
