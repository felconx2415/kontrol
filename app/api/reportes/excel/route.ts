import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import {
  construirFiltro,
  construirRangoFechas,
  type FiltrosReporte,
} from "@/lib/reportes";
import { esGestion, ETIQUETA_ESTADO, ETIQUETA_MOTIVO } from "@/lib/solicitud-estado";
import { LOGO_ALTO, LOGO_ANCHO, LOGO_PNG_BASE64 } from "@/lib/logo";
import { filtroEmpresa } from "@/lib/alcance";
import { duenoAsignacion } from "@/lib/bodega";
import { fechaParaExcel, formatearFechaHora } from "@/lib/vencimientos";

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

  const rango = construirRangoFechas(filtros);
  const deMiEmpresa = filtroEmpresa(usuario.alcance);

  const [solicitudes, prestamos, traslados] = await Promise.all([
    db.solicitud.findMany({
      where: construirFiltro(filtros, usuario.alcance),
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
    }),
    db.prestamo.findMany({
      where: {
        items: { some: { item: deMiEmpresa } },
        ...(rango ? { prestadoEn: rango } : {}),
      },
      orderBy: { prestadoEn: "desc" },
      include: {
        items: {
          include: { item: { select: { codigo: true, nombre: true, unidad: true } } },
        },
        prestadoPor: { select: { nombre: true } },
      },
    }),
    db.asignacionItem.findMany({
      where: {
        item: deMiEmpresa,
        ...(rango || filtros.brigadaId
          ? {
              asignacion: {
                ...(rango ? { asignadoEn: rango } : {}),
                // Lo de la brigada es lo que tiene su gente **y** lo que es de
                // la brigada misma: filtrar solo por sus miembros dejaría fuera
                // la motosierra que es de la cuadrilla.
                ...(filtros.brigadaId
                  ? {
                      OR: [
                        { usuario: { brigadaId: filtros.brigadaId } },
                        { brigadaId: filtros.brigadaId },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: { asignacion: { asignadoEn: "desc" } },
      include: {
        item: { select: { codigo: true, nombre: true, unidad: true } },
        asignacion: {
          select: {
            asignadoEn: true,
            notas: true,
            usuario: {
              select: { id: true, nombre: true, brigada: { select: { nombre: true } } },
            },
            brigada: { select: { id: true, nombre: true } },
            asignadoPor: { select: { nombre: true } },
          },
        },
      },
    }),
  ]);

  const brigada = filtros.brigadaId
    ? await db.brigada.findFirst({
        where: { ...deMiEmpresa, id: filtros.brigadaId },
        select: { nombre: true },
      })
    : null;

  const libro = new ExcelJS.Workbook();
  libro.creator = "Kontrol";
  libro.created = new Date();

  // Portada: la marca, quién y cuándo generó la planilla, y con qué filtros.
  // Va en hoja aparte para no tocar la rejilla de las hojas de datos, donde
  // una banda de encabezado correría las filas y rompería el filtro y el
  // panel congelado.
  const portada = libro.addWorksheet("Portada");
  portada.views = [{ showGridLines: false }];
  portada.getColumn(1).width = 22;
  portada.getColumn(2).width = 46;
  portada.getRow(1).height = 46;

  const idLogo = libro.addImage({
    base64: LOGO_PNG_BASE64,
    extension: "png",
  });
  portada.addImage(idLogo, {
    tl: { col: 0.3, row: 0.35 },
    ext: { width: 200, height: (200 * LOGO_ALTO) / LOGO_ANCHO },
  });

  const filaPortada = (etiqueta: string, valor: string, negrita = false) => {
    const fila = portada.addRow([etiqueta, valor]);
    fila.getCell(1).font = { color: { argb: "FF64748B" }, size: 10 };
    fila.getCell(2).font = { bold: negrita };
    return fila;
  };

  portada.addRow([]);
  const titulo = portada.addRow(["Reporte de solicitudes, préstamos y traslados"]);
  titulo.getCell(1).font = { bold: true, size: 14, color: { argb: "FF031A29" } };
  portada.addRow([]);
  filaPortada("Generado", formatearFechaHora(new Date()));
  filaPortada("Generado por", usuario.nombre);
  portada.addRow([]);

  const cabeceraFiltros = portada.addRow(["Filtros aplicados"]);
  cabeceraFiltros.getCell(1).font = { bold: true, color: { argb: "FF031A29" } };
  filaPortada("Desde", filtros.desde || "Sin límite");
  filaPortada("Hasta", filtros.hasta || "Sin límite");
  filaPortada("Brigada", brigada?.nombre ?? "Todas");
  filaPortada(
    "Estado",
    filtros.estado
      ? (ETIQUETA_ESTADO[filtros.estado as keyof typeof ETIQUETA_ESTADO] ??
        filtros.estado)
      : "Todos",
  );
  filaPortada("Categoría", filtros.categoria || "Todas");
  portada.addRow([]);

  const cabeceraContenido = portada.addRow(["Contenido"]);
  cabeceraContenido.getCell(1).font = { bold: true, color: { argb: "FF031A29" } };
  filaPortada("Solicitudes", `${solicitudes.length} solicitudes`);
  filaPortada("Préstamos", `${prestamos.length} registros`);
  filaPortada("Traslados", `${traslados.length} registros`);

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
    { header: "Cant. pedida", key: "pedida", width: 13 },
    { header: "Cant. entregada", key: "entregada", width: 15 },
    { header: "Motivo", key: "motivo", width: 22 },
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
        pedida: item.cantidad,
        entregada: item.entregaItem?.cantidadEntregada ?? 0,
        motivo: item.motivo ? ETIQUETA_MOTIVO[item.motivo] : "",
        creada: fechaParaExcel(s.creadaEn),
        aprobador: s.aprobador?.nombre ?? "",
        entregadaEn: s.entrega ? fechaParaExcel(s.entrega.entregadaEn) : "",
        vence: item.entregaItem?.venceEn
          ? fechaParaExcel(item.entregaItem.venceEn)
          : "",
      });
    }
  }

  for (const clave of ["creada", "entregadaEn", "vence"]) {
    hoja.getColumn(clave).numFmt = "dd-mm-yyyy";
  }

  // Estilo compartido para la cabecera de cada hoja.
  const encabezar = (h: ExcelJS.Worksheet) => {
    h.getRow(1).font = { bold: true };
    h.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    h.views = [{ state: "frozen", ySplit: 1 }];
  };

  // Hoja de préstamos de la bodega local.
  const hojaPrestamos = libro.addWorksheet("Préstamos");
  hojaPrestamos.columns = [
    { header: "Ítem", key: "item", width: 30 },
    { header: "Código", key: "codigo", width: 12 },
    { header: "Cantidad", key: "cantidad", width: 10 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "Prestado a", key: "persona", width: 24 },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Registró", key: "registro", width: 22 },
    { header: "Salida", key: "salida", width: 14 },
    { header: "Devuelto", key: "devuelto", width: 14 },
    { header: "Nota", key: "nota", width: 30 },
  ];
  encabezar(hojaPrestamos);
  const ETIQUETA_VUELTA: Record<string, string> = {
    BUENO: "Devuelto OK",
    DANADO: "Devuelto dañado",
    PERDIDO: "No devuelto",
  };
  for (const p of prestamos) {
    for (const linea of p.items) {
      hojaPrestamos.addRow({
        item: linea.item.nombre,
        codigo: linea.item.codigo,
        cantidad: linea.cantidad,
        unidad: linea.item.unidad,
        persona: p.persona,
        estado: linea.estadoDevolucion
          ? ETIQUETA_VUELTA[linea.estadoDevolucion]
          : "En préstamo",
        registro: p.prestadoPor.nombre,
        salida: fechaParaExcel(p.prestadoEn),
        devuelto: linea.devueltoEn ? fechaParaExcel(linea.devueltoEn) : "",
        nota: [p.notas, linea.observacion].filter(Boolean).join(" · "),
      });
    }
  }
  for (const clave of ["salida", "devuelto"]) {
    hojaPrestamos.getColumn(clave).numFmt = "dd-mm-yyyy";
  }

  // Hoja de traslados (equipamiento asignado a un usuario en forma definitiva).
  const hojaTraslados = libro.addWorksheet("Traslados");
  hojaTraslados.columns = [
    { header: "Ítem", key: "item", width: 30 },
    { header: "Código", key: "codigo", width: 12 },
    { header: "Cantidad", key: "cantidad", width: 10 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "Asignado a", key: "usuario", width: 24 },
    // Persona o brigada: en una columna aparte para poder filtrar la hoja por
    // ella. Sin esto, «BBOO 2169» en la columna de nombres no se distingue de
    // una persona.
    { header: "Destinatario", key: "destinatario", width: 14 },
    { header: "Brigada", key: "brigada", width: 18 },
    { header: "Asignó", key: "asigno", width: 22 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Nota", key: "nota", width: 30 },
  ];
  encabezar(hojaTraslados);
  for (const t of traslados) {
    hojaTraslados.addRow({
      item: t.item.nombre,
      codigo: t.item.codigo,
      cantidad: t.cantidad,
      unidad: t.item.unidad,
      usuario: duenoAsignacion(t.asignacion).nombre,
      destinatario: duenoAsignacion(t.asignacion).esBrigada ? "Brigada" : "Persona",
      brigada:
        t.asignacion.brigada?.nombre ?? t.asignacion.usuario?.brigada?.nombre ?? "",
      asigno: t.asignacion.asignadoPor.nombre,
      fecha: fechaParaExcel(t.asignacion.asignadoEn),
      nota: t.asignacion.notas ?? "",
    });
  }
  hojaTraslados.getColumn("fecha").numFmt = "dd-mm-yyyy";

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
