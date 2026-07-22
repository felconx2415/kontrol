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

export function formatearFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatearFechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
