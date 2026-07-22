import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { construirFiltro, type FiltrosReporte } from "@/lib/reportes";
import { esGestion, ETIQUETA_ESTADO, ETIQUETA_MOTIVO } from "@/lib/solicitud-estado";

export async function GET(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario || !esGestion(usuario.rol)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filtros: FiltrosReporte = {
    desde: url.searchParams.get("desde") ?? undefined,
    hasta: url.searchParams.get("hasta") ?? undefined,
    brigadaId: url.searchParams.get("brigadaId") ?? undefined,
    estado: url.searchParams.get("estado") ?? undefined,
    categoria: url.searchParams.get("categoria") ?? undefined,
  };

  const solicitudes = await db.solicitud.findMany({
    where: construirFiltro(filtros),
    orderBy: { creadaEn: "desc" },
    include: {
      solicitante: { select: { nombre: true, rut: true } },
      brigada: { select: { nombre: true } },
      aprobador: { select: { nombre: true } },
      entrega: { select: { entregadaEn: true } },
      items: {
        include: {
          articulo: true,
          entregaItem: { select: { cantidadEntregada: true, venceEn: true } },
        },
      },
    },
  });

  const libro = new ExcelJS.Workbook();
  libro.creator = "Kontrol";
  libro.created = new Date();

  // Una fila por ítem: es el grano que sirve para analizar consumo.
  const hoja = libro.addWorksheet("Solicitudes");
  hoja.columns = [
    { header: "Folio", key: "folio", width: 12 },
    { header: "Estado", key: "estado", width: 24 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Solicitante", key: "solicitante", width: 24 },
    { header: "RUT", key: "rut", width: 14 },
    { header: "Brigada", key: "brigada", width: 18 },
    { header: "Artículo", key: "articulo", width: 30 },
    { header: "Código", key: "codigo", width: 12 },
    { header: "Categoría", key: "categoria", width: 16 },
    { header: "Talla", key: "talla", width: 10 },
    { header: "Cant. pedida", key: "pedida", width: 13 },
    { header: "Cant. entregada", key: "entregada", width: 15 },
    { header: "Motivo reemplazo", key: "motivo", width: 20 },
    { header: "Creada", key: "creada", width: 14 },
    { header: "Aprobada por", key: "aprobador", width: 22 },
    { header: "Entregada", key: "entregadaEn", width: 14 },
    { header: "Vence", key: "vence", width: 14 },
  ];

  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  for (const s of solicitudes) {
    for (const item of s.items) {
      hoja.addRow({
        folio: formatearFolio(s.folio),
        estado: ETIQUETA_ESTADO[s.estado],
        tipo: s.tipo === "REEMPLAZO" ? "Reemplazo" : "Nuevo",
        solicitante: s.solicitante.nombre,
        rut: s.solicitante.rut ?? "",
        brigada: s.brigada?.nombre ?? "",
        articulo: item.articulo.nombre,
        codigo: item.articulo.codigo,
        categoria: item.articulo.categoria === "EPP" ? "EPP" : "Equipamiento",
        talla: item.talla ?? "",
        pedida: item.cantidad,
        entregada: item.entregaItem?.cantidadEntregada ?? 0,
        motivo: item.motivoReemplazo ? ETIQUETA_MOTIVO[item.motivoReemplazo] : "",
        creada: s.creadaEn,
        aprobador: s.aprobador?.nombre ?? "",
        entregadaEn: s.entrega?.entregadaEn ?? "",
        vence: item.entregaItem?.venceEn ?? "",
      });
    }
  }

  for (const clave of ["creada", "entregadaEn", "vence"]) {
    hoja.getColumn(clave).numFmt = "dd-mm-yyyy";
  }

  const buffer = await libro.xlsx.writeBuffer();
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kontrol-solicitudes-${fecha}.xlsx"`,
    },
  });
}
