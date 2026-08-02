import "server-only";

import { PDFDocument, StandardFonts, type PDFImage } from "pdf-lib";
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

export type FotoActa = { bytes: Uint8Array; tipo: "png" | "jpg" };

export type DatosActaPrestamo = {
  itemCodigo: string;
  itemNombre: string;
  cantidad: number;
  unidad: string;
  persona: string;
  prestadoPorNombre: string;
  prestadoEn: Date;
  notas: string | null;
  devueltoEn: Date | null;
  observacionesDevolucion: string | null;
  firmaSalidaPng: Uint8Array | null;
  firmaDevolucionPng: Uint8Array | null;
  fotos: FotoActa[];
};

export async function generarActaPrestamoPdf(
  datos: DatosActaPrestamo,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let pagina = pdf.addPage([ANCHO, ALTO]);
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
  texto("Acta de préstamo de bodega", { size: 10, color: GRIS });
  y -= 12;
  linea();
  y -= 24;

  // Datos del préstamo
  const campos: [string, string][] = [
    ["Ítem", `${datos.itemCodigo} · ${datos.itemNombre}`],
    ["Cantidad", `${datos.cantidad} ${datos.unidad}`],
    ["Prestado a", datos.persona],
    ["Registró", datos.prestadoPorNombre],
    ["Fecha de salida", formatearFechaHora(datos.prestadoEn)],
    ["Estado", datos.devueltoEn ? "Devuelto" : "Activo (en préstamo)"],
  ];
  if (datos.devueltoEn) {
    campos.push(["Fecha de devolución", formatearFechaHora(datos.devueltoEn)]);
  }

  for (const [etiqueta, valor] of campos) {
    texto(etiqueta, { size: 9, color: GRIS });
    texto(valor, { x: MARGEN + 130, size: 10, font: negrita });
    y -= 18;
  }

  const parrafo = (titulo: string, cuerpo: string) => {
    y -= 6;
    texto(titulo, { size: 9, color: GRIS });
    y -= 14;
    for (const renglon of envolver(cuerpo, regular, 9, ANCHO - MARGEN * 2)) {
      texto(renglon, { size: 9 });
      y -= 12;
    }
  };

  if (datos.notas) parrafo("Nota del préstamo", datos.notas);
  if (datos.observacionesDevolucion) {
    parrafo("Observaciones de la devolución", datos.observacionesDevolucion);
  }

  // Declaración de recepción. Sin esto el documento solo describe un
  // movimiento; con esto sirve de respaldo de la entrega, que es para lo que
  // se firma. Es la contraparte de la declaración del acta de solicitudes,
  // ajustada a un préstamo: aquí además hay que devolver el material.
  y -= 10;
  texto(
    "Declaro haber recibido en préstamo el material detallado, en buen estado y",
    { size: 9, color: GRIS },
  );
  y -= 12;
  texto(
    "conforme, y me comprometo a devolverlo en las mismas condiciones.",
    { size: 9, color: GRIS },
  );
  y -= 10;

  linea();
  // El hueco tiene que superar el alto de la firma o el trazo se monta sobre
  // el texto de encima.
  y -= ALTO_FIRMA + 14;

  // Firmas: salida a la izquierda, devolución a la derecha.
  const yFirmas = y;
  await bloqueFirma(
    pdf,
    pagina,
    datos.firmaSalidaPng,
    MARGEN,
    yFirmas,
    "Firma de salida",
    datos.persona,
  );
  await bloqueFirma(
    pdf,
    pagina,
    datos.firmaDevolucionPng,
    MARGEN + 260,
    yFirmas,
    "Firma de entrega (devolución)",
    datos.devueltoEn ? datos.persona : "Pendiente de devolución",
  );
  y = yFirmas - 90;

  // Fotos de daños
  if (datos.fotos.length > 0) {
    if (y < 220) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - MARGEN;
    }
    texto("Fotos de daños", { size: 11, font: negrita });
    y -= 8;
    pagina.drawLine({
      start: { x: MARGEN, y },
      end: { x: ANCHO - MARGEN, y },
      thickness: 0.75,
      color: LINEA,
    });
    y -= 16;

    const lado = 150;
    const separacion = 12;
    const porFila = 3;
    let col = 0;
    let filaTop = y;
    for (const foto of datos.fotos) {
      let img: PDFImage | null = null;
      try {
        img = foto.tipo === "png" ? await pdf.embedPng(foto.bytes) : await pdf.embedJpg(foto.bytes);
      } catch {
        img = null; // formato no incrustable (p. ej. webp): se omite.
      }
      if (!img) continue;

      if (col === porFila) {
        col = 0;
        filaTop -= lado + separacion;
      }
      if (filaTop - lado < MARGEN + 30) {
        pagina = pdf.addPage([ANCHO, ALTO]);
        filaTop = ALTO - MARGEN;
        col = 0;
      }
      const escala = Math.min(lado / img.width, lado / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      pagina.drawImage(img, {
        x: MARGEN + col * (lado + separacion),
        y: filaTop - h,
        width: w,
        height: h,
      });
      col++;
    }
  }

  // Pie
  pagina.drawText(`Generado por Kontrol · ${formatearFechaHora(new Date())}`, {
    x: MARGEN,
    y: 30,
    size: 7,
    font: regular,
    color: GRIS,
  });

  return pdf.save();
}

