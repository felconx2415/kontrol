import type { Prisma } from "@/generated/prisma/client";
import type { Categoria, EstadoSolicitud } from "@/generated/prisma/enums";

export type FiltrosReporte = {
  desde?: string;
  hasta?: string;
  brigadaId?: string;
  estado?: string;
  categoria?: string;
};

const ESTADOS_VALIDOS: EstadoSolicitud[] = [
  "BORRADOR",
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
  "EN_GESTION",
  "RECIBIDA",
  "ENTREGADA",
  "CANCELADA",
];

/**
 * Rango de fechas de los filtros, listo para aplicarse a cualquier campo
 * DateTime (creadaEn, prestadoEn, asignadoEn…). Devuelve `undefined` si no hay
 * rango válido, para no ensuciar el where.
 */
export function construirRangoFechas(
  filtros: FiltrosReporte,
): Prisma.DateTimeFilter | undefined {
  const rango: Prisma.DateTimeFilter = {};
  if (filtros.desde) {
    const desde = new Date(filtros.desde);
    if (!Number.isNaN(desde.getTime())) rango.gte = desde;
  }
  if (filtros.hasta) {
    const hasta = new Date(filtros.hasta);
    if (!Number.isNaN(hasta.getTime())) {
      // Incluir el día completo indicado en "hasta".
      hasta.setHours(23, 59, 59, 999);
      rango.lte = hasta;
    }
  }
  return rango.gte || rango.lte ? rango : undefined;
}

/** Traduce los filtros de la URL a un where de Prisma, ignorando lo inválido. */
export function construirFiltro(filtros: FiltrosReporte): Prisma.SolicitudWhereInput {
  const where: Prisma.SolicitudWhereInput = {};

  const rango = construirRangoFechas(filtros);
  if (rango) where.creadaEn = rango;

  if (filtros.brigadaId) where.brigadaId = filtros.brigadaId;

  if (filtros.estado && ESTADOS_VALIDOS.includes(filtros.estado as EstadoSolicitud)) {
    where.estado = filtros.estado as EstadoSolicitud;
  }

  if (filtros.categoria === "EPP" || filtros.categoria === "EQUIPAMIENTO") {
    where.items = {
      some: { articulo: { categoria: filtros.categoria as Categoria } },
    };
  }

  return where;
}
