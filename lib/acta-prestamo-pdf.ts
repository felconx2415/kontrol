import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import { formatearFechaHora } from "@/lib/vencimientos";

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

const MARGEN = 50;
const NEGRO = rgb(0.06, 0.09, 0.16);
const GRIS = rgb(0.45, 0.5, 0.56);
const LINEA = rgb(0.85, 0.87, 0.9);
const ANCHO = 595;
const ALTO = 842; // A4

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
  texto("KONTROL", { size: 18, font: negrita });
  y -= 16;
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

  y -= 10;
  linea();
  y -= 30;

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

/** Dibuja una firma (o un espacio en blanco) con su línea y nombre debajo. */
async function bloqueFirma(
  pdf: PDFDocument,
  pagina: PDFPage,
  firmaPng: Uint8Array | null,
  x: number,
  yBase: number,
  titulo: string,
  nombre: string,
) {
  const ancho = 200;
  if (firmaPng) {
    try {
      const firma = await pdf.embedPng(firmaPng);
      const escala = Math.min(180 / firma.width, 60 / firma.height);
      pagina.drawImage(firma, {
        x,
        y: yBase + 6,
        width: firma.width * escala,
        height: firma.height * escala,
      });
    } catch {
      // firma ilegible: se deja el espacio en blanco.
    }
  }
  pagina.drawLine({
    start: { x, y: yBase },
    end: { x: x + ancho, y: yBase },
    thickness: 0.75,
    color: NEGRO,
  });
  pagina.drawText(nombre, {
    x,
    y: yBase - 14,
    size: 9,
    font: await pdf.embedFont(StandardFonts.HelveticaBold),
    color: NEGRO,
  });
  pagina.drawText(titulo, {
    x,
    y: yBase - 26,
    size: 8,
    font: await pdf.embedFont(StandardFonts.Helvetica),
    color: GRIS,
  });
}

/** Envuelve texto a mano: pdf-lib no lo hace solo. */
function envolver(
  texto: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  anchoMax: number,
): string[] {
  const palabras = texto.split(/\s+/);
  const renglones: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const tentativo = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(tentativo, size) > anchoMax && actual) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = tentativo;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}
