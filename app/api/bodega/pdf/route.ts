import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { esGestion } from "@/lib/solicitud-estado";
import { cantidadConSigno, ETIQUETA_MOVIMIENTO } from "@/lib/bodega";
import { generarBodegaPdf } from "@/lib/bodega-pdf";

export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario || !esGestion(usuario.rol)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const [items, movimientos] = await Promise.all([
    db.itemBodega.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        prestamos: { where: { estado: "ACTIVO" }, select: { cantidad: true } },
      },
    }),
    db.movimientoBodega.findMany({
      orderBy: { creadoEn: "desc" },
      take: 2000,
      include: {
        item: { select: { codigo: true, nombre: true } },
        usuario: { select: { nombre: true } },
      },
    }),
  ]);

  const pdf = await generarBodegaPdf({
    generadoPor: usuario.nombre,
    items: items.map((i) => ({
      codigo: i.codigo,
      nombre: i.nombre,
      categoria: i.categoria,
      ubicacion: i.ubicacion,
      stock: i.stock,
      unidad: i.unidad,
      prestado: i.prestamos.reduce((s, p) => s + p.cantidad, 0),
      activo: i.activo,
    })),
    movimientos: movimientos.map((m) => ({
      fecha: m.creadoEn,
      itemCodigo: m.item.codigo,
      itemNombre: m.item.nombre,
      tipo: ETIQUETA_MOVIMIENTO[m.tipo],
      cantidad: cantidadConSigno(m.tipo, m.cantidad),
      stock: m.stockResultante,
      persona: m.persona,
      registro: m.usuario.nombre,
      nota: m.notas,
    })),
  });

  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kontrol-bodega-${fecha}.pdf"`,
    },
  });
}
