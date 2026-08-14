import "server-only";

import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";

/**
 * Verificación pública de un documento emitido por Kontrol.
 *
 * El QR del acta apunta aquí. Quien la escanea —un fiscalizador, prevención de
 * riesgos, la propia persona— necesita confirmar que el papel que tiene en la
 * mano corresponde a un registro real y no a una impresión inventada.
 *
 * La página es pública a propósito, y por eso **no devuelve datos personales**:
 * ni nombres, ni RUT, ni a quién se entregó. Solo confirma que el documento
 * existe, de qué tipo es, cuándo se emitió y que está firmado. Quien tiene el
 * papel ya ve el resto; quien no lo tiene no debería enterarse por una URL.
 *
 * El código lleva el id (un cuid), así que no se puede adivinar recorriendo
 * números correlativos.
 */

export type TipoDocumento = "entrega" | "asignacion" | "prestamo";

const PREFIJO: Record<TipoDocumento, string> = {
  entrega: "e",
  asignacion: "a",
  prestamo: "p",
};

export function codigoVerificacion(tipo: TipoDocumento, id: string): string {
  return `${PREFIJO[tipo]}-${id}`;
}

export type DocumentoVerificado = {
  tipo: TipoDocumento;
  etiquetaTipo: string;
  numero: string;
  emitidoEn: Date;
  totalItems: number;
  firmado: boolean;
  /** Estado propio del documento, cuando aporta algo (p. ej. si se devolvió). */
  nota: string | null;
};

export async function verificarDocumento(
  codigo: string,
): Promise<DocumentoVerificado | null> {
  const guion = codigo.indexOf("-");
  if (guion < 1) return null;

  const prefijo = codigo.slice(0, guion);
  const id = codigo.slice(guion + 1);
  if (!id) return null;

  if (prefijo === PREFIJO.entrega) {
    const entrega = await db.entrega.findUnique({
      where: { id },
      select: {
        entregadaEn: true,
        firmaPngUrl: true,
        solicitud: { select: { folio: true } },
        _count: { select: { items: true } },
      },
    });
    if (!entrega) return null;
    return {
      tipo: "entrega",
      etiquetaTipo: "Acta de entrega de equipamiento y EPP",
      numero: formatearFolio(entrega.solicitud.folio),
      emitidoEn: entrega.entregadaEn,
      totalItems: entrega._count.items,
      firmado: Boolean(entrega.firmaPngUrl),
      nota: null,
    };
  }

  if (prefijo === PREFIJO.asignacion) {
    const asignacion = await db.asignacionBodega.findUnique({
      where: { id },
      select: {
        asignadoEn: true,
        firmaPngUrl: true,
        _count: { select: { items: true } },
      },
    });
    if (!asignacion) return null;
    return {
      tipo: "asignacion",
      etiquetaTipo: "Acta de entrega de equipamiento de bodega",
      numero: id.slice(-6).toUpperCase(),
      emitidoEn: asignacion.asignadoEn,
      totalItems: asignacion._count.items,
      firmado: Boolean(asignacion.firmaPngUrl),
      nota: "Entrega definitiva",
    };
  }

  if (prefijo === PREFIJO.prestamo) {
    const prestamo = await db.prestamo.findUnique({
      where: { id },
      select: {
        prestadoEn: true,
        firmaSalidaUrl: true,
        devueltoEn: true,
        _count: { select: { items: true } },
      },
    });
    if (!prestamo) return null;
    return {
      tipo: "prestamo",
      etiquetaTipo: "Acta de préstamo de bodega",
      numero: id.slice(-6).toUpperCase(),
      emitidoEn: prestamo.prestadoEn,
      totalItems: prestamo._count.items,
      firmado: Boolean(prestamo.firmaSalidaUrl),
      nota: prestamo.devueltoEn ? "Material devuelto" : "Devolución pendiente",
    };
  }

  return null;
}
