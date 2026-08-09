import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { origenPublico } from "@/lib/origen";
import { esGestion } from "@/lib/solicitud-estado";
import { actaDePrestamo } from "@/lib/actas/generar";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario || !esGestion(usuario.rol)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const { id } = await params;

  // El préstamo se busca dentro del alcance: fuera de él, «no existe».
  const prestamo = await db.prestamo.findFirst({
    where: { id, items: { some: { item: filtroEmpresa(usuario.alcance) } } },
    select: { id: true },
  });
  if (!prestamo) {
    return NextResponse.json({ error: "El préstamo no existe." }, { status: 404 });
  }

  const pdf = await actaDePrestamo(id, origenPublico(request));
  if (!pdf) {
    return NextResponse.json({ error: "El préstamo no existe." }, { status: 404 });
  }

  const nombreArchivo = `acta-prestamo-${id.slice(-6).toUpperCase()}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
