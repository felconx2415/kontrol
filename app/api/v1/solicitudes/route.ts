import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { conToken, iso, leerPaginacion, respuestaLista } from "@/lib/api-respuesta";
import { formatearFolio } from "@/lib/folio";
import type { EstadoSolicitud, Prisma, TipoSolicitud } from "@/generated/prisma/client";

const ESTADOS: EstadoSolicitud[] = [
  "BORRADOR",
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
  "RESERVA_SOLICITADA",
  "EN_GESTION",
  "RECIBIDA",
  "ENTREGADA",
  "CANCELADA",
];

/**
 * Listado de solicitudes.
 *
 * El filtro por empresa sale del token y va primero: los demás filtros llegan
 * de la URL y no pueden ensancharlo. Es el mismo `filtroEmpresa` que usa la
 * interfaz, así que la API no puede quedarse atrás de las reglas del sistema.
 */
export const GET = conToken(async (request, llamante) => {
  const url = new URL(request.url);
  const pagina = leerPaginacion(url);

  const where: Prisma.SolicitudWhereInput = { ...filtroEmpresa(llamante.alcance) };

  const estado = url.searchParams.get("estado");
  if (estado && ESTADOS.includes(estado as EstadoSolicitud)) {
    where.estado = estado as EstadoSolicitud;
  }

  const tipo = url.searchParams.get("tipo");
  if (tipo === "NUEVO" || tipo === "REEMPLAZO") {
    where.tipo = tipo as TipoSolicitud;
  }

  const brigadaId = url.searchParams.get("brigadaId");
  if (brigadaId) where.brigadaId = brigadaId;

  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  const rango: Prisma.DateTimeFilter = {};
  if (desde && !Number.isNaN(Date.parse(desde))) rango.gte = new Date(desde);
  if (hasta && !Number.isNaN(Date.parse(hasta))) {
    const fin = new Date(hasta);
    fin.setHours(23, 59, 59, 999); // el día indicado entra completo
    rango.lte = fin;
  }
  if (rango.gte || rango.lte) where.creadaEn = rango;

  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const folio = Number(q.replace(/\D/g, ""));
    where.OR = [
      ...(Number.isFinite(folio) && folio > 0 ? [{ folio }] : []),
      { solicitante: { nombre: { contains: q } } },
    ];
  }

  const [total, solicitudes] = await Promise.all([
    db.solicitud.count({ where }),
    db.solicitud.findMany({
      where,
      orderBy: { creadaEn: "desc" },
      skip: pagina.saltar,
      take: pagina.porPagina,
      select: {
        id: true,
        folio: true,
        tipo: true,
        estado: true,
        creadaEn: true,
        enviadaEn: true,
        aprobadaEn: true,
        enGestionEn: true,
        recibidaEn: true,
        canceladaEn: true,
        motivoRechazo: true,
        solicitante: { select: { id: true, nombre: true, rut: true } },
        brigada: { select: { id: true, nombre: true } },
        empresa: { select: { id: true, nombre: true } },
        _count: { select: { items: true } },
        entrega: { select: { entregadaEn: true } },
      },
    }),
  ]);

  return respuestaLista(
    solicitudes.map((s) => ({
      id: s.id,
      folio: formatearFolio(s.folio),
      tipo: s.tipo,
      estado: s.estado,
      solicitante: s.solicitante,
      brigada: s.brigada,
      empresa: s.empresa,
      totalItems: s._count.items,
      fechas: {
        creada: iso(s.creadaEn),
        enviada: iso(s.enviadaEn),
        aprobada: iso(s.aprobadaEn),
        enGestion: iso(s.enGestionEn),
        recibida: iso(s.recibidaEn),
        entregada: iso(s.entrega?.entregadaEn),
        cancelada: iso(s.canceladaEn),
      },
      motivoRechazo: s.motivoRechazo,
    })),
    total,
    pagina,
  );
});
