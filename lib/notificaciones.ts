import "server-only";

import { db } from "@/lib/db";
import type { Rol, TipoNotificacion } from "@/generated/prisma/enums";

/**
 * Avisos dirigidos, para los cuatro roles.
 *
 * Es distinto de `lib/avisos.ts`: aquello es la confirmación efímera de lo que
 * acabas de hacer («solicitud aprobada»), muere en la siguiente pantalla y solo
 * la ve quien apretó el botón. Esto es lo contrario — le cuenta a **otra**
 * persona algo que pasó mientras no miraba, y espera en la campana hasta que lo
 * lea.
 *
 * Regla que ordena todo el archivo: se notifica a quien tiene que **hacer**
 * algo o a quien está **esperando** ese hecho. Nunca a quien lo provocó: ya lo
 * sabe, y una campana que repite lo que uno mismo hizo se vuelve ruido y deja
 * de mirarse.
 */

/** Cuántas se traen al listado y cuántas caben en el menú de la campana. */
export const NOTIFICACIONES_POR_PAGINA = 30;
export const NOTIFICACIONES_EN_CAMPANA = 8;

export type Notificacion = {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  url: string | null;
  leidaEn: Date | null;
  creadaEn: Date;
};

/**
 * Crea la notificación para cada destinatario.
 *
 * `excluir` saca a quien originó el hecho aunque caiga en la lista por su rol:
 * el gestor que aprueba también es de los que reciben «hay algo que aprobar».
 * Los ids repetidos se colapsan, así que quien es a la vez aprobador y
 * destinatario recibe una sola.
 */
export async function notificar(params: {
  destinatarios: string[];
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  url?: string | null;
  excluir?: string | null;
}): Promise<number> {
  const destinatarios = [...new Set(params.destinatarios)].filter(
    (id) => id && id !== params.excluir,
  );

  if (destinatarios.length === 0) return 0;

  await db.notificacion.createMany({
    data: destinatarios.map((usuarioId) => ({
      usuarioId,
      tipo: params.tipo,
      titulo: params.titulo,
      cuerpo: params.cuerpo,
      url: params.url ?? null,
    })),
  });

  return destinatarios.length;
}

/**
 * Quiénes tienen alguno de estos roles dentro de una empresa.
 *
 * Un gestor no se busca por `empresaId` sino por las empresas que atiende: su
 * cuenta puede pertenecer a una y llevar la logística de otra, y quien tiene
 * que enterarse del pedido es el que lo va a gestionar.
 */
export async function destinatariosPorRol(
  roles: Rol[],
  empresaId: string | null,
): Promise<string[]> {
  const gestiona = roles.filter((r) => r === "GESTOR" || r === "ADMIN");
  const propios = roles.filter((r) => r !== "GESTOR" && r !== "ADMIN");

  const [dePlanta, deGestion] = await Promise.all([
    propios.length > 0
      ? db.usuario.findMany({
          where: { activo: true, rol: { in: propios }, empresaId },
          select: { id: true },
        })
      : [],
    gestiona.length > 0
      ? db.usuario.findMany({
          where: {
            activo: true,
            rol: { in: gestiona },
            ...(empresaId
              ? {
                  OR: [
                    // El ADMIN no se limita a una empresa: se entera de todo.
                    { rol: "ADMIN" },
                    { empresasGestionadas: { some: { id: empresaId } } },
                    // Gestor sin empresas asignadas: su alcance cae en la
                    // suya, y aquí tiene que caer igual (ver lib/alcance.ts).
                    { empresaId, empresasGestionadas: { none: {} } },
                  ],
                }
              : {}),
          },
          select: { id: true },
        })
      : [],
  ]);

  return [...dePlanta, ...deGestion].map((u) => u.id);
}

/** Cuántas esperan sin leer. Es el número del globo de la campana. */
export function contarNoLeidas(usuarioId: string): Promise<number> {
  return db.notificacion.count({ where: { usuarioId, leidaEn: null } });
}

/** Las últimas, leídas y sin leer, más recientes primero. */
export function listarNotificaciones(
  usuarioId: string,
  take = NOTIFICACIONES_POR_PAGINA,
): Promise<Notificacion[]> {
  return db.notificacion.findMany({
    where: { usuarioId },
    orderBy: { creadaEn: "desc" },
    take,
    select: {
      id: true,
      tipo: true,
      titulo: true,
      cuerpo: true,
      url: true,
      leidaEn: true,
      creadaEn: true,
    },
  });
}

/** Marca una como leída. El `usuarioId` impide marcar la de otro. */
export async function marcarLeida(usuarioId: string, id: string): Promise<void> {
  await db.notificacion.updateMany({
    where: { id, usuarioId, leidaEn: null },
    data: { leidaEn: new Date() },
  });
}

export async function marcarTodasLeidas(usuarioId: string): Promise<number> {
  const { count } = await db.notificacion.updateMany({
    where: { usuarioId, leidaEn: null },
    data: { leidaEn: new Date() },
  });
  return count;
}

/**
 * Quién debería enterarse de lo que le pasa a una solicitud, según a qué
 * estado llegó. Vive aquí, en una sola tabla, para que el ciclo de vida no
 * quede repartido en frases sueltas por las Server Actions.
 */
export const ROLES_A_AVISAR: Partial<Record<TipoNotificacion, Rol[]>> = {
  // Un pedido nuevo espera a que alguien lo revise.
  SOLICITUD_CREADA: ["APROBADOR", "GESTOR", "ADMIN"],
  // Ya aprobado, la pelota pasa a quien lo pide al almacén.
  SOLICITUD_APROBADA: ["GESTOR", "ADMIN"],
  // El material llegó a bodega: hay que citar a la persona y entregárselo.
  SOLICITUD_RECIBIDA: ["GESTOR", "ADMIN"],
};
