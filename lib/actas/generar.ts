import "server-only";

import { db } from "@/lib/db";
import { ETIQUETA_ROL } from "@/lib/solicitud-estado";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha, formatearFechaHora } from "@/lib/vencimientos";
import QRCode from "qrcode";
import { htmlAPdf, subidaComoDataUri } from "@/lib/render-pdf";
import { construirActaHtml, type FirmaActa, type ItemActa } from "@/lib/actas/plantilla";
import { codigoVerificacion, type TipoDocumento } from "@/lib/verificacion";

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

/**
 * QR que lleva a la verificación pública del documento. `origen` viene de la
 * petición, así que el código apunta al dominio por el que realmente se está
 * usando la app y no a uno fijado en configuración.
 */
async function qrDe(
  origen: string | null,
  tipo: TipoDocumento,
  id: string,
): Promise<{ imagen: string; url: string } | null> {
  if (!origen) return null;
  const url = `${origen}/v/${codigoVerificacion(tipo, id)}`;
  const imagen = await QRCode.toDataURL(url, {
    margin: 0,
    width: 240,
    errorCorrectionLevel: "M",
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
  return { imagen, url };
}

const fechaHora = (d: Date) => formatearFechaHora(d);
const fechaCorta = (d: Date) => formatearFecha(d);

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

export async function actaDeEntrega(
  entregaId: string,
  origen: string | null = null,
): Promise<Uint8Array | null> {
  const entrega = await db.entrega.findUnique({
    where: { id: entregaId },
    include: {
      receptor: {
        select: { nombre: true, rut: true, rol: true, brigada: { select: { nombre: true } } },
      },
      entregadoPor: { select: { nombre: true, rut: true, firmaPngUrl: true } },
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
      serie: i.numeroSerie,
      cantidad: `${i.cantidadEntregada} ${i.solicitudItem.articulo.unidad}`,
      // Lo que sale por una solicitud es siempre material nuevo del almacén.
      estado: "Nuevo",
      vence: vence.texto,
      alerta: vence.alerta,
    };
  });

  // La del receptor se captura en el momento; la de quien entrega sale de su
  // perfil, porque nadie puede firmar a mano cada acta que emite.
  const [firma, firmaEntrega] = await Promise.all([
    subidaComoDataUri(entrega.firmaPngUrl),
    subidaComoDataUri(entrega.entregadoPor.firmaPngUrl),
  ]);
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
      imagen: firmaEntrega,
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
    qr: await qrDe(origen, "entrega", entrega.id),
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

export async function actaDePrestamo(
  prestamoId: string,
  origen: string | null = null,
): Promise<Uint8Array | null> {
  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      items: {
        include: { item: { select: { codigo: true, nombre: true, unidad: true } } },
      },
      prestadoPor: { select: { nombre: true, rut: true, firmaPngUrl: true } },
    },
  });
  if (!prestamo) return null;

  const [firmaSalida, firmaDevolucion, firmaEntrega] = await Promise.all([
    subidaComoDataUri(prestamo.firmaSalidaUrl),
    subidaComoDataUri(prestamo.firmaDevolucionUrl),
    subidaComoDataUri(prestamo.prestadoPor.firmaPngUrl),
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
      imagen: firmaEntrega,
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

  const ETIQUETA_VUELTA: Record<string, string> = {
    BUENO: "Devuelto OK",
    DANADO: "Devuelto dañado",
    PERDIDO: "No devuelto",
  };

  const items: ItemActa[] = prestamo.items.map((linea) => ({
    articulo: linea.item.nombre,
    codigo: linea.item.codigo,
    serie: linea.numeroSerie,
    cantidad: `${linea.cantidad} ${linea.item.unidad}`,
    // La columna «Estado» dice cómo volvió cada cosa, que es justo lo que se
    // revisa al recibir un préstamo.
    estado: linea.estadoDevolucion
      ? ETIQUETA_VUELTA[linea.estadoDevolucion]
      : "En préstamo",
    vence: null,
    // Lo que no volvió bien se destaca, igual que un vencimiento próximo.
    alerta: linea.estadoDevolucion === "DANADO" || linea.estadoDevolucion === "PERDIDO",
  }));

  // Las novedades de cada línea van al detalle: en la tabla no cabe el relato.
  const novedades = prestamo.items
    .filter((l) => l.observacion)
    .map((l) => ({
      rotulo: `Novedad · ${l.item.nombre}`,
      texto: l.observacion!,
    }));

  const html = await construirActaHtml({
    titulo: `Acta de préstamo ${prestamo.id.slice(-6).toUpperCase()} · Kontrol`,
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
    items,
    notas: [...notas, ...novedades],
    declaracion: DECLARACION_PRESTAMO,
    firmas,
    copias: COPIAS,
    qr: await qrDe(origen, "prestamo", prestamo.id),
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
  origen: string | null = null,
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
      asignadoPor: { select: { nombre: true, rut: true, firmaPngUrl: true } },
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
        serie: asignacion.numeroSerie,
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
        imagen: await subidaComoDataUri(asignacion.asignadoPor.firmaPngUrl),
        nombre: asignacion.asignadoPor.nombre,
        rut: asignacion.asignadoPor.rut,
        fecha,
        rol: "Firma de quien entrega",
      },
    ],
    copias: COPIAS,
    qr: await qrDe(origen, "asignacion", asignacion.id),
  });

  return { pdf: await htmlAPdf(html), usuarioId: asignacion.usuario.id };
}
