import "server-only";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { dibujarLogo, incrustarLogo } from "@/lib/logo-pdf";
import { formatearFechaHora } from "@/lib/vencimientos";
import {
  ALTO,
  ALTO_FIRMA,
  ANCHO,
  bloqueFirma,
  envolver,
  GRIS,
  LINEA,
  MARGEN,
  NEGRO,
} from "@/lib/acta-comun";

export type DatosActaAsignacion = {
  itemCodigo: string;
  itemNombre: string;
  cantidad: number;
  unidad: string;
  usuarioNombre: string;
  usuarioBrigada: string | null;
  asignadoPorNombre: string;
  asignadoEn: Date;
  notas: string | null;
  firmaPng: Uint8Array | null;
};

/**
 * Acta de una asignación de bodega: la entrega definitiva de material a un
 * usuario del sistema.
 *
 * Se diferencia del acta de préstamo en lo esencial: aquí no hay devolución
 * que esperar, así que lleva una sola firma y el compromiso que se declara es
 * de uso y cuidado, no de restitución.
 */
export async function generarActaAsignacionPdf(
  datos: DatosActaAsignacion,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([ANCHO, ALTO]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = ALTO - MARGEN;

  const texto = (
    contenido: string,
    o: { x?: number; size?: number; font?: typeof regular; color?: typeof NEGRO } = {},
  ) => {
    pagina.drawText(contenido, {
      x: o.x ?? MARGEN,
      y,
      size: o.size ?? 10,
      font: o.font ?? regular,
      color: o.color ?? NEGRO,
    });
  };

  const linea = () => {
    pagina.drawLine({
      start: { x: MARGEN, y },
      end: { x: ANCHO - MARGEN, y },
      thickness: 0.75,
      color: LINEA,
    });
  };

  // Encabezado
  const ALTO_LOGO = 26;
  const logo = await incrustarLogo(pdf);
  dibujarLogo(pagina, logo, { x: MARGEN, yTop: y, alto: ALTO_LOGO });
  y -= ALTO_LOGO + 12;
  texto("Acta de entrega de equipamiento de bodega", { size: 10, color: GRIS });
  y -= 12;
  linea();
  y -= 24;

  const campos: [string, string][] = [
    ["Ítem", `${datos.itemCodigo} · ${datos.itemNombre}`],
    ["Cantidad", `${datos.cantidad} ${datos.unidad}`],
    ["Entregado a", datos.usuarioNombre],
    ...((datos.usuarioBrigada ? [["Brigada", datos.usuarioBrigada]] : []) as [
      string,
      string,
    ][]),
    ["Entregó", datos.asignadoPorNombre],
    ["Fecha de entrega", formatearFechaHora(datos.asignadoEn)],
    ["Tipo de salida", "Entrega definitiva (no se devuelve a bodega)"],
  ];

  for (const [etiqueta, valor] of campos) {
    texto(etiqueta, { size: 9, color: GRIS });
    texto(valor, { x: MARGEN + 130, size: 10, font: negrita });
    y -= 18;
  }

  if (datos.notas) {
    y -= 6;
    texto("Nota de la entrega", { size: 9, color: GRIS });
    y -= 14;
    for (const renglon of envolver(datos.notas, regular, 9, ANCHO - MARGEN * 2)) {
      texto(renglon, { size: 9 });
      y -= 12;
    }
  }

  // Declaración de recepción: es lo que convierte el documento en respaldo de
  // la entrega y no en una simple descripción del movimiento.
  y -= 10;
  texto(
    "Declaro haber recibido conforme el equipamiento detallado y me comprometo a su",
    { size: 9, color: GRIS },
  );
  y -= 12;
  texto("uso y cuidado según el reglamento vigente.", { size: 9, color: GRIS });
  y -= 10;

  linea();
  // El hueco tiene que superar el alto de la firma o el trazo se monta sobre
  // el texto de encima.
  y -= ALTO_FIRMA + 14;

  await bloqueFirma(
    pdf,
    pagina,
    datos.firmaPng,
    MARGEN,
    y,
    "Firma de quien recibe",
    datos.usuarioNombre,
  );

  pagina.drawText(`Generado por Kontrol · ${formatearFechaHora(new Date())}`, {
    x: MARGEN,
    y: 30,
    size: 7,
    font: regular,
    color: GRIS,
  });

  return pdf.save();
}
