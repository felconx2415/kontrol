import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { esGestion, ETIQUETA_MOTIVO } from "@/lib/solicitud-estado";

// Solo se envían al almacén interno los ítems de este centro de costo. El resto
// (otro CECO) va por otro canal y no entra en esta planilla.
const CECO_ALMACEN = "FD1400D082";
// Almacén de destino; por ahora es fijo.
const ALMACEN = "FLA1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario || !esGestion(usuario.rol)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const { id } = await params;

  const solicitud = await db.solicitud.findUnique({
    where: { id },
    include: {
      solicitante: { select: { nombre: true } },
      brigada: { select: { nombre: true, tipo: true } },
      items: {
        include: { articulo: { select: { codigo: true, nombre: true, ceco: true } } },
      },
    },
  });

  if (!solicitud) {
    return NextResponse.json({ error: "La solicitud no existe." }, { status: 404 });
  }

  const items = solicitud.items.filter(
    (i) => i.articulo.ceco === CECO_ALMACEN,
  );
  if (items.length === 0) {
    return NextResponse.json(
      { error: `La solicitud no tiene ítems del CECO ${CECO_ALMACEN}.` },
      { status: 404 },
    );
  }

  // El nombre de la brigada va en la columna que corresponde a su tipo; la otra
  // queda en «-».
  const esEmpresa = solicitud.brigada?.tipo === "EMPRESA";
  const esContratista = solicitud.brigada?.tipo === "CONTRATISTA";
  const brigadaEmpresa = esEmpresa ? solicitud.brigada!.nombre : "-";
  const brigadaContratista = esContratista ? solicitud.brigada!.nombre : "-";
  const fechaSolicitud = solicitud.enviadaEn ?? solicitud.creadaEn;

  const libro = new ExcelJS.Workbook();
  libro.creator = "Kontrol";
  libro.created = new Date();

  const hoja = libro.addWorksheet("Solicitud almacén");
  hoja.columns = [
    { header: "USUARIO O DESTINATARIO", key: "usuario", width: 30 },
    { header: "BRIGADA EMPRESA", key: "empresa", width: 20 },
    { header: "BRIGADA CONTRATISTA (NOMBRE)", key: "contratista", width: 24 },
    { header: "CENTRO DE COSTO", key: "ceco", width: 16 },
    { header: "ALMACEN", key: "almacen", width: 10 },
    { header: "CÓDIGO MATERIAL", key: "codigo", width: 16 },
    { header: "DESCRIPCIÓN", key: "descripcion", width: 42 },
    { header: "CANTIDAD", key: "cantidad", width: 10 },
    { header: "Estado", key: "estado", width: 22 },
    { header: "Reserva", key: "reserva", width: 12 },
    { header: "Fecha Solicitud", key: "fecha", width: 14 },
  ];

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true };
  encabezado.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  encabezado.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDDEBF7" },
  };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  for (const item of items) {
    hoja.addRow({
      usuario: solicitud.solicitante.nombre,
      empresa: brigadaEmpresa,
      contratista: brigadaContratista,
      ceco: item.articulo.ceco ?? CECO_ALMACEN,
      almacen: ALMACEN,
      codigo: item.articulo.codigo,
      descripcion: item.articulo.nombre,
      cantidad: item.cantidad,
      estado: item.motivo ? ETIQUETA_MOTIVO[item.motivo] : "",
      reserva: "",
      fecha: fechaSolicitud,
    });
  }

  hoja.getColumn("fecha").numFmt = "dd-mm-yyyy";
  hoja.getColumn("cantidad").alignment = { horizontal: "center" };

  const buffer = await libro.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="almacen-${formatearFolio(solicitud.folio)}.xlsx"`,
    },
  });
}
