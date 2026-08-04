export const DIAS_AVISO_VENCIMIENTO = 30;

export type EstadoVencimiento = "VIGENTE" | "POR_VENCER" | "VENCIDO" | "SIN_VENCIMIENTO";

export function calcularVenceEn(
  entregadoEn: Date,
  vidaUtilDias: number | null,
): Date | null {
  if (!vidaUtilDias) return null;
  const vence = new Date(entregadoEn);
  vence.setDate(vence.getDate() + vidaUtilDias);
  return vence;
}

export function diasRestantes(venceEn: Date, ahora = new Date()): number {
  const ms = venceEn.getTime() - ahora.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function estadoVencimiento(
  venceEn: Date | null,
  ahora = new Date(),
): EstadoVencimiento {
  if (!venceEn) return "SIN_VENCIMIENTO";
  const dias = diasRestantes(venceEn, ahora);
  if (dias < 0) return "VENCIDO";
  if (dias <= DIAS_AVISO_VENCIMIENTO) return "POR_VENCER";
  return "VIGENTE";
}

export const ETIQUETA_VENCIMIENTO: Record<EstadoVencimiento, string> = {
  VIGENTE: "Vigente",
  POR_VENCER: "Por vencer",
  VENCIDO: "Vencido",
  SIN_VENCIMIENTO: "Sin vencimiento",
};

export const COLOR_VENCIMIENTO: Record<EstadoVencimiento, string> = {
  VIGENTE: "bg-exito-fondo text-exito ring-exito-borde",
  POR_VENCER: "bg-espera-fondo text-espera ring-espera-borde",
  VENCIDO: "bg-fallo-fondo text-fallo ring-fallo-borde",
  SIN_VENCIMIENTO: "bg-lienzo text-tinta-suave ring-borde-fuerte",
};

/**
 * Zona horaria de la operación. Toda fecha que se muestre o se imprima se
 * formatea aquí, sin excepción.
 *
 * Sin fijarla, cada fecha se renderiza en la zona de quien la formatea: el
 * servidor —en producción, UTC— para las páginas y los PDF, y el equipo de cada
 * persona para lo que se arma en el navegador. Un acta emitida a las 21:00 en
 * Chile salía fechada a las 01:00 del día siguiente, y ese documento es un
 * respaldo firmado: la hora tiene que ser la de acá.
 */
export const ZONA_HORARIA = "America/Santiago";

export function formatearFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-CL", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatearFechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleString("es-CL", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Fecha lista para escribirse como fecha (no texto) en una planilla Excel.
 *
 * Excel guarda un número sin zona horaria y ExcelJS lo calcula desde el UTC del
 * Date, así que un pedido del 3 de agosto a las 22:00 en Chile —4 de agosto en
 * UTC— aparecía fechado un día después. Se traslada el día chileno al mediodía
 * UTC: la celda sigue siendo una fecha ordenable y muestra el día correcto.
 */
export function fechaParaExcel(fecha: Date | string): Date {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const [dia, mes, anio] = formatearFecha(d).split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}
