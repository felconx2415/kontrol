import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha, formatearFechaHora } from "@/lib/vencimientos";

export type DatosActa = {
  folio: number;
  tipo: "NUEVO" | "REEMPLAZO";
  receptorNombre: string;
  receptorRut: string | null;
  brigadaNombre: string | null;
  entregadoPorNombre: string;
  entregadaEn: Date;
  observaciones: string | null;
  items: {
    nombre: string;
    codigo: string;
    cantidad: number;
    unidad: string;
    venceEn: Date | null;
  }[];
  firmaPng: Uint8Array;
};

const MARGEN = 50;
const NEGRO = rgb(0.06, 0.09, 0.16);
const GRIS = rgb(0.45, 0.5, 0.56);
const LINEA = rgb(0.85, 0.87, 0.9);

export async function generarActaPdf(datos: DatosActa): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595, 842]); // A4
  const { width, height } = pagina.getSize();

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = height - MARGEN;

  const texto = (
    contenido: string,
    opciones: { x?: number; size?: number; font?: typeof regular; color?: typeof NEGRO } = {},
  ) => {
    pagina.drawText(contenido, {
      x: opciones.x ?? MARGEN,
      y,
      size: opciones.size ?? 10,
      font: opciones.font ?? regular,
      color: opciones.color ?? NEGRO,
    });
  };

  const linea = () => {
    pagina.drawLine({
      start: { x: MARGEN, y },
      end: { x: width - MARGEN, y },
      thickness: 0.75,
      color: LINEA,
    });
  };

  // Encabezado
  texto("KONTROL", { size: 18, font: negrita });
  y -= 16;
  texto("Acta de entrega de equipamiento y EPP", { size: 10, color: GRIS });
  y -= 8;

  pagina.drawText(formatearFolio(datos.folio), {
    x: width - MARGEN - negrita.widthOfTextAtSize(formatearFolio(datos.folio), 14),
    y: height - MARGEN,
    size: 14,
    font: negrita,
    color: NEGRO,
  });

  y -= 12;
  linea();
  y -= 24;

  // Datos de la entrega
  const campos: [string, string][] = [
    ["Receptor", datos.receptorNombre],
    ["RUT", datos.receptorRut ?? "—"],
    ["Brigada", datos.brigadaNombre ?? "—"],
    ["Tipo de solicitud", datos.tipo === "REEMPLAZO" ? "Reemplazo" : "Equipamiento nuevo"],
    ["Fecha de entrega", formatearFechaHora(datos.entregadaEn)],
    ["Entregado por", datos.entregadoPorNombre],
  ];

  for (const [etiqueta, valor] of campos) {
    texto(etiqueta, { size: 9, color: GRIS });
    texto(valor, { x: MARGEN + 130, size: 10, font: negrita });
    y -= 18;
  }

  y -= 10;
  linea();
  y -= 22;

  // Tabla de ítems
  texto("Ítems entregados", { size: 11, font: negrita });
  y -= 18;

  const columnas = [MARGEN, MARGEN + 230, MARGEN + 300, MARGEN + 400];
  const encabezados = ["Artículo", "Código", "Cant.", "Vence"];

  encabezados.forEach((h, i) => {
    pagina.drawText(h, {
      x: columnas[i],
      y,
      size: 8,
      font: negrita,
      color: GRIS,
    });
  });
  y -= 6;
  linea();
  y -= 14;

  for (const item of datos.items) {
    // Truncar nombres largos para que no invadan la columna siguiente.
    let nombre = item.nombre;
    while (regular.widthOfTextAtSize(nombre, 9) > 220 && nombre.length > 4) {
      nombre = `${nombre.slice(0, -2)}…`;
    }

    const celdas = [
      nombre,
      item.codigo,
      `${item.cantidad} ${item.unidad}`,
      item.venceEn ? formatearFecha(item.venceEn) : "—",
    ];

    celdas.forEach((celda, i) => {
      pagina.drawText(celda, {
        x: columnas[i],
        y,
        size: 9,
        font: regular,
        color: NEGRO,
      });
    });
    y -= 16;
  }

  y -= 6;
  linea();
  y -= 24;

  if (datos.observaciones) {
    texto("Observaciones", { size: 9, color: GRIS });
    y -= 14;
    // Ajuste de línea manual: pdf-lib no envuelve texto.
    const palabras = datos.observaciones.split(/\s+/);
    let renglon = "";
    for (const palabra of palabras) {
      const tentativo = renglon ? `${renglon} ${palabra}` : palabra;
      if (regular.widthOfTextAtSize(tentativo, 9) > width - MARGEN * 2) {
        texto(renglon, { size: 9 });
        y -= 12;
        renglon = palabra;
      } else {
        renglon = tentativo;
      }
    }
    if (renglon) {
      texto(renglon, { size: 9 });
      y -= 12;
    }
    y -= 14;
  }

  // Declaración y firma
  texto(
    "Declaro haber recibido conforme el equipamiento detallado y me comprometo a su",
    { size: 9, color: GRIS },
  );
  y -= 12;
  texto("uso y cuidado según el reglamento vigente.", { size: 9, color: GRIS });
  y -= 40;

  const firma = await pdf.embedPng(datos.firmaPng);
  const escala = Math.min(180 / firma.width, 70 / firma.height);
  pagina.drawImage(firma, {
    x: MARGEN,
    y: y - firma.height * escala + 40,
    width: firma.width * escala,
    height: firma.height * escala,
  });

  y -= 30;
  pagina.drawLine({
    start: { x: MARGEN, y },
    end: { x: MARGEN + 200, y },
    thickness: 0.75,
    color: NEGRO,
  });
  y -= 14;
  texto(datos.receptorNombre, { size: 9, font: negrita });
  y -= 12;
  texto("Firma del receptor", { size: 8, color: GRIS });

  // Pie
  pagina.drawText(
    `Generado por Kontrol · ${formatearFechaHora(new Date())}`,
    { x: MARGEN, y: 30, size: 7, font: regular, color: GRIS },
  );

  return pdf.save();
}
