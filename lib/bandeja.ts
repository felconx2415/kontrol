import "server-only";

import { db } from "@/lib/db";
import type { Rol } from "@/generated/prisma/enums";
import { DIAS_AVISO_VENCIMIENTO } from "@/lib/vencimientos";
import { esGestion } from "@/lib/solicitud-estado";

/**
 * Qué le toca hacer AHORA a quien mira la pantalla.
 *
 * El escritorio antes contaba cosas ("3 pendientes"); esto entrega las
 * solicitudes concretas sobre las que el rol puede actuar, para resolverlas
 * desde el propio panel.
 */
export type GrupoBandeja = {
  clave: string;
  titulo: string;
  /** Qué hacer con estas solicitudes, en una línea. */
  indicacion: string;
  /** Texto del enlace de acción en cada fila. */
  accion: string;
  solicitudes: SolicitudBandeja[];
};

export type SolicitudBandeja = {
  id: string;
  folio: number;
  tipo: "NUEVO" | "REEMPLAZO";
  solicitanteNombre: string;
  brigadaNombre: string | null;
  creadaEn: Date;
  totalItems: number;
};

const SELECCION = {
  select: {
    id: true,
    folio: true,
    tipo: true,
    creadaEn: true,
    solicitante: { select: { nombre: true } },
    brigada: { select: { nombre: true } },
    _count: { select: { items: true } },
  },
} as const;

type FilaCruda = {
  id: string;
  folio: number;
  tipo: "NUEVO" | "REEMPLAZO";
  creadaEn: Date;
  solicitante: { nombre: string };
  brigada: { nombre: string } | null;
  _count: { items: number };
};

function mapear(filas: FilaCruda[]): SolicitudBandeja[] {
  return filas.map((s) => ({
    id: s.id,
    folio: s.folio,
    tipo: s.tipo,
    solicitanteNombre: s.solicitante.nombre,
    brigadaNombre: s.brigada?.nombre ?? null,
    creadaEn: s.creadaEn,
    totalItems: s._count.items,
  }));
}

export async function construirBandeja(
  usuarioId: string,
  rol: Rol,
): Promise<GrupoBandeja[]> {
  const grupos: GrupoBandeja[] = [];

  if (rol === "APROBADOR" || esGestion(rol)) {
    const porAprobar = await db.solicitud.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { enviadaEn: "asc" }, // lo más antiguo primero: no dejar a nadie esperando
      take: 12,
      ...SELECCION,
    });
    grupos.push({
      clave: "aprobar",
      titulo: "Esperan tu aprobación",
      indicacion: "Revisa la justificación y aprueba o rechaza.",
      accion: "Revisar",
      solicitudes: mapear(porAprobar),
    });
  }

  if (esGestion(rol)) {
    const [porPedir, porRecibir, porEntregar] = await Promise.all([
      db.solicitud.findMany({
        where: { estado: "APROBADA" },
        orderBy: { aprobadaEn: "asc" },
        take: 12,
        ...SELECCION,
      }),
      db.solicitud.findMany({
        where: { estado: "EN_GESTION" },
        orderBy: { enGestionEn: "asc" },
        take: 12,
        ...SELECCION,
      }),
      db.solicitud.findMany({
        where: { estado: "RECIBIDA" },
        orderBy: { recibidaEn: "asc" },
        take: 12,
        ...SELECCION,
      }),
    ]);

    grupos.push(
      {
        clave: "pedir",
        titulo: "Por pedir al almacén",
        indicacion: "Aprobadas y a la espera de que hagas el pedido externo.",
        accion: "Pedir",
        solicitudes: mapear(porPedir),
      },
      {
        clave: "recibir",
        titulo: "En camino desde el almacén",
        indicacion: "Marca la recepción cuando llegue el material a bodega.",
        accion: "Marcar recibida",
        solicitudes: mapear(porRecibir),
      },
      {
        clave: "entregar",
        titulo: "Listas para entregar",
        indicacion: "El material está en bodega: entrega y toma la firma.",
        accion: "Entregar",
        solicitudes: mapear(porEntregar),
      },
    );
  }

  // Todos ven lo suyo: qué pedí y en qué va.
  const mias = await db.solicitud.findMany({
    where: {
      solicitanteId: usuarioId,
      estado: { in: ["BORRADOR", "PENDIENTE", "APROBADA", "EN_GESTION", "RECIBIDA"] },
    },
    orderBy: { creadaEn: "desc" },
    take: 12,
    ...SELECCION,
  });

  grupos.push({
    clave: "mias",
    titulo: "Mis solicitudes en curso",
    indicacion: "Lo que pediste y todavía no recibes.",
    accion: "Ver",
    solicitudes: mapear(mias),
  });

  return grupos.filter((g) => g.solicitudes.length > 0);
}

/** EPP vencido o próximo a vencer, para quien gestiona las entregas. */
export async function alertasVencimiento(rol: Rol) {
  if (rol === "SOLICITANTE") return [];

  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_AVISO_VENCIMIENTO);

  return db.entregaItem.findMany({
    where: { reemplazadoEn: null, venceEn: { not: null, lte: limite } },
    orderBy: { venceEn: "asc" },
    take: 6,
    include: {
      entrega: { include: { receptor: { select: { id: true, nombre: true } } } },
      solicitudItem: { include: { articulo: { select: { nombre: true } } } },
    },
  });
}
