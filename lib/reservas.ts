import "server-only";

import { db } from "@/lib/db";
import { filtroEmpresa, type Alcance } from "@/lib/alcance";

/**
 * Las últimas reservas usadas, para no volver a teclearlas.
 *
 * El número de reserva son diez dígitos que el gestor copia del almacén y
 * reparte entre varias solicitudes seguidas: una misma reserva cubre el pedido
 * de una brigada entera. Tecleárselo de nuevo en cada folio es donde se cuelan
 * los errores, y un dígito mal deja la línea imposible de retirar.
 *
 * Se ofrecen como atajo, nunca como valor por defecto: cuál corresponde lo sabe
 * la persona, no el sistema.
 */
export type ReservaReciente = {
  numero: string;
  /** CECO desde el que se usó; los dos orígenes no se mezclan. */
  ceco: string | null;
  /** Cuándo se usó por última vez. */
  usadaEn: Date | null;
  /**
   * Última posición ocupada dentro de esa reserva («0040»), o null si no lleva
   * posiciones. Al reutilizar la reserva, la numeración sigue desde ahí en vez
   * de volver a empezar en 0010 y chocar con lo ya pedido.
   */
  ultimaPosicion: string | null;
};

/** Cuántas se ofrecen. Más de esto deja de ser un atajo y es una lista. */
const CUANTAS = 6;

/**
 * Ventana de líneas que se mira para armar la lista. Se deduplica en memoria y
 * no con `distinct` porque lo que interesa no es solo el número, sino la última
 * posición de cada uno, y eso pide ver todas sus líneas.
 */
const LINEAS_A_MIRAR = 200;

export async function reservasRecientes(
  alcance: Alcance,
): Promise<ReservaReciente[]> {
  const lineas = await db.solicitudItem.findMany({
    where: {
      numeroReserva: { not: null },
      solicitud: filtroEmpresa(alcance),
    },
    orderBy: { solicitud: { enGestionEn: "desc" } },
    take: LINEAS_A_MIRAR,
    select: {
      numeroReserva: true,
      posicionReserva: true,
      articulo: { select: { ceco: true } },
      solicitud: { select: { enGestionEn: true } },
    },
  });

  const porNumero = new Map<string, ReservaReciente>();

  for (const linea of lineas) {
    const numero = linea.numeroReserva?.trim();
    if (!numero) continue;

    const actual = porNumero.get(numero) ?? {
      numero,
      ceco: linea.articulo.ceco,
      usadaEn: linea.solicitud.enGestionEn,
      ultimaPosicion: null,
    };

    // Las posiciones son correlativas con ceros a la izquierda («0010»,
    // «0100»), así que comparar como texto ordenaría mal en cuanto cambie el
    // largo: se comparan como número.
    const posicion = linea.posicionReserva?.trim();
    if (posicion) {
      const mayor =
        actual.ultimaPosicion === null ||
        Number(posicion) > Number(actual.ultimaPosicion);
      if (mayor) actual.ultimaPosicion = posicion;
    }

    porNumero.set(numero, actual);
  }

  return [...porNumero.values()].slice(0, CUANTAS);
}
