import type { TipoMovimiento } from "@/generated/prisma/enums";

/**
 * Reglas y etiquetas de la Bodega local. Única fuente de verdad para la UI y
 * las Server Actions: qué tipos de movimiento existen, cómo se leen y cómo
 * afectan al stock.
 */

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA: "Ingreso",
  SALIDA: "Salida",
  PRESTAMO: "Préstamo",
  DEVOLUCION: "Devolución",
  AJUSTE: "Ajuste",
  ASIGNACION: "Asignación",
};

/** Color de la píldora por tipo de movimiento (clases ya resueltas). */
export const COLOR_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA: "bg-exito-fondo text-exito ring-exito-borde",
  SALIDA: "bg-fallo-fondo text-fallo ring-fallo-borde",
  PRESTAMO: "bg-espera-fondo text-espera ring-espera-borde",
  DEVOLUCION: "bg-marca-50 text-marca-700 ring-marca-200",
  AJUSTE: "bg-lienzo text-tinta-suave ring-borde",
  ASIGNACION: "bg-fallo-fondo text-fallo ring-fallo-borde",
};

/**
 * Cómo se muestra la cantidad de un movimiento según su tipo: con signo para
 * las entradas/salidas y con «=» para los ajustes (que fijan un absoluto).
 */
export function cantidadConSigno(tipo: TipoMovimiento, cantidad: number): string {
  switch (tipo) {
    case "ENTRADA":
    case "DEVOLUCION":
      return `+${cantidad}`;
    case "SALIDA":
    case "PRESTAMO":
    case "ASIGNACION":
      return `−${cantidad}`;
    case "AJUSTE":
      return `= ${cantidad}`;
  }
}

/**
 * Tipos que el usuario elige en el formulario de movimiento manual. El préstamo
 * NO está aquí: tiene su propio flujo firmado (/bodega/prestar).
 */
export const TIPOS_MOVIMIENTO_MANUAL: TipoMovimiento[] = [
  "ENTRADA",
  "SALIDA",
  "AJUSTE",
];

/** Estos tipos identifican a la persona que recibe/toma el material. */
export const REQUIERE_PERSONA: TipoMovimiento[] = ["SALIDA"];

/**
 * Stock igual o inferior a este valor se marca como «bajo» en el KPI y el
 * filtro del inventario. Incluye el 0 (sin stock). Es un umbral global simple;
 * si más adelante hace falta un mínimo por ítem, se mueve al modelo.
 */
export const UMBRAL_STOCK_BAJO = 3;
