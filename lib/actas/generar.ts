import "server-only";

import { db } from "@/lib/db";
import { ETIQUETA_ROL } from "@/lib/solicitud-estado";
import { formatearFolio } from "@/lib/folio";
import { htmlAPdf, subidaComoDataUri } from "@/lib/render-pdf";
import { construirActaHtml, type FirmaActa, type ItemActa } from "@/lib/actas/plantilla";

/**
 * Las tres actas del sistema, sobre el formato A4 único de la organización.
 *
 * Cada una aporta lo suyo (quién recibe, qué se entrega, qué se declara) y la
 * plantilla pone el resto. Se agrupan aquí para que las diferencias entre
 * ellas se lean de una vez, en lugar de repartidas por tres rutas.
 */

/** Área fija de quien entrega: hoy toda salida de material pasa por bodega. */
const AREA_ENTREGA = "Bodega / Pañol";

const COPIAS = "Original: bodega · Copia: trabajador · Copia: prevención de riesgos";

/** Un vencimiento a menos de 90 días se destaca en el acta. */
const DIAS_ALERTA = 90;

const fechaHora = (d: Date) =>
  d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fechaCorta = (d: Date) =>
  d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });

function venceComoTexto(venceEn: Date | null): { texto: string | null; alerta: boolean } {
  if (!venceEn) return { texto: null, alerta: false };
  const dias = Math.ceil((venceEn.getTime() - Date.now()) / 86_400_000);
  return { texto: fechaCorta(venceEn), alerta: dias < DIAS_ALERTA };
}

// ── Acta de entrega de una solicitud ──────────────────────────────────────

const DECLARACION_ENTREGA =
  "Declaro haber recibido conforme el equipamiento detallado, en buen estado y con la " +
  "instrucción correspondiente sobre su uso. Me comprometo a utilizarlo de forma obligatoria " +
  "durante la jornada, mantenerlo operativo, informar de inmediato cualquier deterioro, " +
  "pérdida o vencimiento, y restituirlo al término de la faena o de la relación laboral, " +
  "conforme a la Ley N° 16.744 y a la normativa vigente de seguridad y salud en el trabajo.";

export async function actaDeEntrega(entregaId: string): Promise<Uint8Array | null> {
  const entrega = await db.entrega.findUnique({
    where: { id: entregaId },
    include: {
      receptor: {
        select: { nombre: true, rut: true, rol: true, brigada: { select: { nombre: true } } },
      },
      entregadoPor: { select: { nombre: true, rut: true } },
      solicitud: { include: { brigada: { select: { nombre: true } } } },
      items: { include: { solicitudItem: { include: { articulo: true } } } },
    },
  });
  if (!entrega) return null;

  const items: ItemActa[] = entrega.items.map((i) => {
    const vence = venceComoTexto(i.venceEn);
    return {
      articulo: i.solicitudItem.articulo.nombre,
      codigo: i.solicitudItem.articulo.codigo,
      // El modelo no guarda número de serie por unidad entregada.
      serie: null,
      cantidad: `${i.cantidadEntregada} ${i.solicitudItem.articulo.unidad}`,
      // Lo que sale por una solicitud es siempre material nuevo del almacén.
      estado: "Nuevo",
      vence: vence.texto,
      alerta: vence.alerta,
    };
  });

  const firma = await subidaComoDataUri(entrega.firmaPngUrl);
  const fecha = fechaCorta(entrega.entregadaEn);

  const firmas: FirmaActa[] = [
    {
      imagen: firma,
      nombre: entrega.receptor.nombre,
      rut: entrega.receptor.rut,
      fecha,
      rol: "Firma del receptor",
    },
    {
      imagen: null,
      nombre: entrega.entregadoPor.nombre,
      rut: entrega.entregadoPor.rut,
      fecha,
      rol: "Firma de quien entrega",
    },
  ];

  const html = await construirActaHtml({
    titulo: `Acta de entrega ${formatearFolio(entrega.solicitud.folio)} · Kontrol`,
    subtitulo: "Acta de entrega de equipamiento y EPP",
    folioRotulo: "Acta N°",
    folio: formatearFolio(entrega.solicitud.folio),
    emitidoEn: fechaHora(entrega.entregadaEn),
    tipoRotulo: "Tipo de solicitud",
    tipoValor:
      entrega.solicitud.tipo === "REEMPLAZO" ? "Reemplazo" : "Equipamiento nuevo",
    recibe: {
      nombre: entrega.receptor.nombre,
      campos: [
        { rotulo: "RUT", valor: entrega.receptor.rut, dato: true },
        {
          rotulo: "Brigada",
          valor: entrega.solicitud.brigada?.nombre ?? entrega.receptor.brigada?.nombre ?? null,
        },
        { rotulo: "Cargo", valor: ETIQUETA_ROL[entrega.receptor.rol] },
      ],
    },
    entrega: {
      nombre: entrega.entregadoPor.nombre,
      campos: [
        { rotulo: "RUT", valor: entrega.entregadoPor.rut, dato: true },
        { rotulo: "Área", valor: AREA_ENTREGA },
      ],
    },
    itemsTitulo: "Equipamiento entregado",
    items,
    notas: entrega.observaciones
      ? [{ rotulo: "Observaciones", texto: entrega.observaciones }]
      : [],
    declaracion: DECLARACION_ENTREGA,
    firmas,
    copias: COPIAS,
  });

  return htmlAPdf(html);
}

// ── Acta de préstamo de bodega ────────────────────────────────────────────

const DECLARACION_PRESTAMO =
  "Declaro haber recibido en préstamo el material detallado, en buen estado y conforme, y me " +
  "comprometo a utilizarlo según su finalidad, mantenerlo operativo, informar de inmediato " +
  "cualquier deterioro o pérdida, y restituirlo a bodega en las mismas condiciones al término " +
  "de su uso, conforme a la Ley N° 16.744 y a la normativa vigente de seguridad y salud en el " +
  "trabajo.";

export async function actaDePrestamo(prestamoId: string): Promise<Uint8Array | null> {
  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      item: { select: { codigo: true, nombre: true, unidad: true } },
      prestadoPor: { select: { nombre: true, rut: true } },
    },
  });
  if (!prestamo) return null;

  const [firmaSalida, firmaDevolucion] = await Promise.all([
    subidaComoDataUri(prestamo.firmaSalidaUrl),
    subidaComoDataUri(prestamo.firmaDevolucionUrl),
  ]);

  const devuelto = prestamo.devueltoEn !== null;

  const firmas: FirmaActa[] = [
    {
      imagen: firmaSalida,
      nombre: prestamo.persona,
      rut: null,
      fecha: fechaCorta(prestamo.prestadoEn),
      rol: "Firma de salida (recibe)",
    },
    {
      imagen: null,
      nombre: prestamo.prestadoPor.nombre,
      rut: prestamo.prestadoPor.rut,
      fecha: fechaCorta(prestamo.prestadoEn),
      rol: "Firma de quien entrega",
    },
    {
      imagen: firmaDevolucion,
      nombre: devuelto ? prestamo.persona : "Pendiente de devolución",
      rut: null,
      fecha: prestamo.devueltoEn ? fechaCorta(prestamo.devueltoEn) : null,
      rol: "Firma de devolución",
      // Aquí sí falta un acto: el material todavía no vuelve.
      pendiente: devuelto ? null : "Sin devolver",
    },
  ];

  const notas = [
    prestamo.notas ? { rotulo: "Nota del préstamo", texto: prestamo.notas } : null,
    prestamo.observacionesDevolucion
      ? { rotulo: "Observaciones de la devolución", texto: prestamo.observacionesDevolucion }
      : null,
  ].filter((n): n is { rotulo: string; texto: string } => n !== null);

  const html = await construirActaHtml({
    titulo: `Acta de préstamo ${prestamo.item.codigo} · Kontrol`,
    subtitulo: "Acta de préstamo de bodega",
    folioRotulo: "Préstamo N°",
    folio: prestamo.id.slice(-6).toUpperCase(),
    emitidoEn: fechaHora(prestamo.prestadoEn),
    tipoRotulo: "Tipo de salida",
    tipoValor: devuelto
      ? `Préstamo devuelto el ${fechaCorta(prestamo.devueltoEn!)}`
      : "Préstamo con devolución pendiente",
    recibe: {
      nombre: prestamo.persona,
      campos: [
        // Un préstamo puede ir a una cuadrilla, no solo a un usuario del
        // sistema, así que aquí no hay RUT ni cargo que consultar.
        { rotulo: "RUT", valor: null, dato: true },
        { rotulo: "Brigada", valor: null },
        { rotulo: "Cargo", valor: null },
      ],
    },
    entrega: {
      nombre: prestamo.prestadoPor.nombre,
      campos: [
        { rotulo: "RUT", valor: prestamo.prestadoPor.rut, dato: true },
        { rotulo: "Área", valor: AREA_ENTREGA },
      ],
    },
    itemsTitulo: "Material prestado",
    items: [
      {
        articulo: prestamo.item.nombre,
        codigo: prestamo.item.codigo,
        serie: null,
        cantidad: `${prestamo.cantidad} ${prestamo.item.unidad}`,
        estado: null,
        vence: null,
      },
    ],
    notas,
    declaracion: DECLARACION_PRESTAMO,
    firmas,
    copias: COPIAS,
  });

  return htmlAPdf(html);
}

// ── Acta de asignación de bodega ──────────────────────────────────────────

const DECLARACION_ASIGNACION =
  "Declaro haber recibido conforme el equipamiento detallado, en buen estado y con la " +
  "instrucción correspondiente sobre su uso. Me comprometo a utilizarlo de forma obligatoria " +
  "durante la jornada, mantenerlo operativo, informar de inmediato cualquier deterioro o " +
  "pérdida, y restituirlo al término de la faena o de la relación laboral, conforme a la " +
  "Ley N° 16.744 y a la normativa vigente de seguridad y salud en el trabajo.";

export async function actaDeAsignacion(
  asignacionId: string,
): Promise<{ pdf: Uint8Array; usuarioId: string } | null> {
  const asignacion = await db.asignacionBodega.findUnique({
    where: { id: asignacionId },
    include: {
      item: { select: { codigo: true, nombre: true, unidad: true } },
      usuario: {
        select: {
          id: true,
          nombre: true,
          rut: true,
          rol: true,
          brigada: { select: { nombre: true } },
        },
      },
      asignadoPor: { select: { nombre: true, rut: true } },
    },
  });
  if (!asignacion) return null;

  const fecha = fechaCorta(asignacion.asignadoEn);

  const html = await construirActaHtml({
    titulo: `Acta de entrega ${asignacion.item.codigo} · Kontrol`,
    subtitulo: "Acta de entrega de equipamiento de bodega",
    folioRotulo: "Entrega N°",
    folio: asignacion.id.slice(-6).toUpperCase(),
    emitidoEn: fechaHora(asignacion.asignadoEn),
    tipoRotulo: "Tipo de salida",
    tipoValor: "Entrega definitiva (no se devuelve a bodega)",
    recibe: {
      nombre: asignacion.usuario.nombre,
      campos: [
        { rotulo: "RUT", valor: asignacion.usuario.rut, dato: true },
        { rotulo: "Brigada", valor: asignacion.usuario.brigada?.nombre ?? null },
        { rotulo: "Cargo", valor: ETIQUETA_ROL[asignacion.usuario.rol] },
      ],
    },
    entrega: {
      nombre: asignacion.asignadoPor.nombre,
      campos: [
        { rotulo: "RUT", valor: asignacion.asignadoPor.rut, dato: true },
        { rotulo: "Área", valor: AREA_ENTREGA },
      ],
    },
    itemsTitulo: "Equipamiento entregado",
    items: [
      {
        articulo: asignacion.item.nombre,
        codigo: asignacion.item.codigo,
        serie: null,
        cantidad: `${asignacion.cantidad} ${asignacion.item.unidad}`,
        estado: null,
        vence: null,
      },
    ],
    notas: asignacion.notas
      ? [{ rotulo: "Nota de la entrega", texto: asignacion.notas }]
      : [],
    declaracion: DECLARACION_ASIGNACION,
    firmas: [
      {
        imagen: await subidaComoDataUri(asignacion.firmaPngUrl),
        nombre: asignacion.usuario.nombre,
        rut: asignacion.usuario.rut,
        fecha,
        rol: "Firma del receptor",
      },
      {
        imagen: null,
        nombre: asignacion.asignadoPor.nombre,
        rut: asignacion.asignadoPor.rut,
        fecha,
        rol: "Firma de quien entrega",
      },
    ],
    copias: COPIAS,
  });

  return { pdf: await htmlAPdf(html), usuarioId: asignacion.usuario.id };
}
