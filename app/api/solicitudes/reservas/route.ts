import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { usuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { CECO_RESERVA_PROPIA, esGestion } from "@/lib/solicitud-estado";

/**
 * Planilla de las líneas con reserva propia (CECO 200/IM136), para pedirlas al
 * almacén.
 *
 * Es otro documento que el de `/api/solicitudes/almacen`, no una variante: ahí
 * la planilla se manda **para que** el almacén entregue la reserva, y por eso
 * describe el pedido entero. Aquí la reserva ya está hecha —la creó el gestor—
 * así que lo único que el almacén necesita es a nombre de quién va cada línea y
 * con qué reserva y posición retirarla.
 *
 * Acepta `?ids=a,b,c` y vuelca todas en una sola hoja, ordenadas por folio.
 */
export async function GET(request: Request) {
  const usuario = await usuarioActual();
  if (!usuario || !esGestion(usuario.rol)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }

  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Indica al menos una solicitud." },
      { status: 400 },
    );
  }

  const solicitudes = await db.solicitud.findMany({
    where: { id: { in: ids } },
    orderBy: { folio: "asc" },
    include: {
      solicitante: { select: { nombre: true } },
      items: {
        include: {
          articulo: { select: { codigo: true, nombre: true, ceco: true } },
        },
      },
    },
  });

  if (solicitudes.length === 0) {
    return NextResponse.json(
      { error: "No se encontró ninguna de las solicitudes." },
      { status: 404 },
    );
  }

  const libro = new ExcelJS.Workbook();
  libro.creator = "Kontrol";
  libro.created = new Date();

  const hoja = libro.addWorksheet("Reservas");
  hoja.columns = [
    { header: "USUARIO O DESTINATARIO", key: "usuario", width: 30 },
    { header: "CÓDIGO MATERIAL", key: "codigo", width: 18 },
    { header: "DESCRIPCIÓN", key: "descripcion", width: 42 },
    { header: "CANTIDAD", key: "cantidad", width: 10 },
    { header: "RESERVA", key: "reserva", width: 16 },
    { header: "POSICIÓN", key: "posicion", width: 12 },
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

  const conLineas: number[] = [];

  for (const solicitud of solicitudes) {
    // Sin número de reserva la línea no sirve para retirar nada, así que no
    // entra: la planilla se descarga después de cargar la reserva.
    const items = solicitud.items.filter(
      (i) => i.articulo.ceco === CECO_RESERVA_PROPIA && i.numeroReserva,
    );
    if (items.length === 0) continue;

    for (const item of items) {
      hoja.addRow({
        usuario: solicitud.solicitante.nombre,
        codigo: item.articulo.codigo,
        descripcion: item.articulo.nombre,
        cantidad: item.cantidad,
        reserva: item.numeroReserva,
        posicion: item.posicionReserva ?? "",
      });
    }

    conLineas.push(solicitud.folio);
  }

  if (conLineas.length === 0) {
    return NextResponse.json(
      {
        error: `Ninguna de las solicitudes seleccionadas tiene líneas del CECO ${CECO_RESERVA_PROPIA} con la reserva cargada.`,
      },
      { status: 404 },
    );
  }

  hoja.getColumn("cantidad").alignment = { horizontal: "center" };
  hoja.getColumn("reserva").alignment = { horizontal: "left" };
  hoja.getColumn("posicion").alignment = { horizontal: "center" };

  const nombre =
    conLineas.length === 1
      ? `reservas-${formatearFolio(conLineas[0])}.xlsx`
      : `reservas-${formatearFolio(conLineas[0])}-a-${formatearFolio(
          conLineas[conLineas.length - 1],
        )}-${conLineas.length}-solicitudes.xlsx`;

  const buffer = await libro.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
