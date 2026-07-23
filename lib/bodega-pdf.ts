import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatearFechaHora } from "@/lib/vencimientos";

export type ItemStockPdf = {
  codigo: string;
  nombre: string;
  categoria: string;
  ubicacion: string | null;
  stock: number;
  unidad: string;
  prestado: number;
  activo: boolean;
};

export type MovimientoPdf = {
  fecha: Date;
  itemCodigo: string;
  itemNombre: string;
  tipo: string;
  cantidad: string;
  stock: number;
  persona: string | null;
  registro: string;
  nota: string | null;
};

const MARGEN = 40;
const ANCHO = 842; // A4 apaisado: las tablas son anchas.
const ALTO = 595;
const NEGRO = rgb(0.06, 0.09, 0.16);
const GRIS = rgb(0.45, 0.5, 0.56);
const LINEA = rgb(0.85, 0.87, 0.9);
const FONDO_CAB = rgb(0.89, 0.91, 0.94);
const USABLE = ANCHO - MARGEN * 2;

type Col = { titulo: string; ancho: number; der?: boolean };

/**
 * Deja el texto codificable por las fuentes estándar (WinAnsi / Latin-1):
 * normaliza la puntuación tipográfica a ASCII y reemplaza lo que quede fuera
 * (emoji, otros alfabetos, el «menos» matemático de cantidadConSigno) por «?».
 * Sin esto, pdf-lib lanza al encontrar un carácter que no puede codificar.
 */
function sanear(s: string): string {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

export async function generarBodegaPdf(datos: {
  items: ItemStockPdf[];
  movimientos: MovimientoPdf[];
  generadoPor: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const nuevaPagina = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
  };

  // pdf-lib no recorta texto: se corta a mano al ancho de la columna.
  const recortar = (t: string, font: PDFFont, size: number, max: number) => {
    const s0 = sanear(t);
    if (font.widthOfTextAtSize(s0, size) <= max) return s0;
    let s = s0;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > max) {
      s = s.slice(0, -1);
    }
    return `${s}...`;
  };

  const encabezadoTabla = (cols: Col[]) => {
    pagina.drawRectangle({
      x: MARGEN,
      y: y - 13,
      width: USABLE,
      height: 16,
      color: FONDO_CAB,
    });
    let x = MARGEN + 4;
    for (const c of cols) {
      const tw = negrita.widthOfTextAtSize(c.titulo, 8);
      pagina.drawText(c.titulo, {
        x: c.der ? x + c.ancho - 8 - tw : x,
        y: y - 10,
        size: 8,
        font: negrita,
        color: NEGRO,
      });
      x += c.ancho;
    }
    y -= 22;
  };

  const filaTabla = (cols: Col[], celdas: string[], atenuada = false) => {
    if (y < MARGEN + 24) {
      nuevaPagina();
      encabezadoTabla(cols);
    }
    let x = MARGEN + 4;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const val = recortar(celdas[i] ?? "", regular, 8, c.ancho - 8);
      const tw = regular.widthOfTextAtSize(val, 8);
      pagina.drawText(val, {
        x: c.der ? x + c.ancho - 8 - tw : x,
        y,
        size: 8,
        font: regular,
        color: atenuada ? GRIS : NEGRO,
      });
      x += c.ancho;
    }
    y -= 5;
    pagina.drawLine({
      start: { x: MARGEN, y },
      end: { x: ANCHO - MARGEN, y },
      thickness: 0.5,
      color: LINEA,
    });
    y -= 11;
  };

  const tituloSeccion = (titulo: string, subtitulo: string) => {
    if (y < MARGEN + 70) nuevaPagina();
    pagina.drawText(titulo, { x: MARGEN, y, size: 13, font: negrita, color: NEGRO });
    y -= 14;
    pagina.drawText(subtitulo, { x: MARGEN, y, size: 8, font: regular, color: GRIS });
    y -= 18;
  };

  // Encabezado del documento.
  pagina.drawText("KONTROL", { x: MARGEN, y, size: 16, font: negrita, color: NEGRO });
  pagina.drawText("Bodega local", {
    x: MARGEN + 92,
    y: y + 1,
    size: 10,
    font: regular,
    color: GRIS,
  });
  const pie = sanear(
    `Generado ${formatearFechaHora(new Date())} · ${datos.generadoPor}`,
  );
  pagina.drawText(pie, {
    x: ANCHO - MARGEN - regular.widthOfTextAtSize(pie, 8),
    y: y + 2,
    size: 8,
    font: regular,
    color: GRIS,
  });
  y -= 28;

  // Sección 1 — Stock en bodega.
  const totalUnidades = datos.items.reduce((s, i) => s + i.stock, 0);
  const activos = datos.items.filter((i) => i.activo).length;
  tituloSeccion(
    "Stock en bodega",
    `${datos.items.length} ítems (${activos} activos) · ${totalUnidades} unidades en stock`,
  );

  const colsStock: Col[] = [
    { titulo: "Código", ancho: 80 },
    { titulo: "Nombre", ancho: 250 },
    { titulo: "Categoría", ancho: 110 },
    { titulo: "Ubicación", ancho: 110 },
    { titulo: "Stock", ancho: 110, der: true },
    { titulo: "Prestado", ancho: 82, der: true },
  ];

  if (datos.items.length === 0) {
    pagina.drawText("Sin ítems en la bodega.", { x: MARGEN, y, size: 9, font: regular, color: GRIS });
    y -= 16;
  } else {
    encabezadoTabla(colsStock);
    for (const it of datos.items) {
      filaTabla(
        colsStock,
        [
          it.codigo,
          it.nombre,
          it.categoria,
          it.ubicacion ?? "—",
          `${it.stock} ${it.unidad}`,
          it.prestado > 0 ? String(it.prestado) : "—",
        ],
        !it.activo,
      );
    }
  }

  // Sección 2 — Movimientos.
  y -= 12;
  tituloSeccion("Movimientos", `${datos.movimientos.length} registros (del más reciente)`);

  const colsMov: Col[] = [
    { titulo: "Fecha", ancho: 105 },
    { titulo: "Ítem", ancho: 180 },
    { titulo: "Tipo", ancho: 80 },
    { titulo: "Cantidad", ancho: 60, der: true },
    { titulo: "Stock", ancho: 50, der: true },
    { titulo: "Persona", ancho: 95 },
    { titulo: "Registró", ancho: 90 },
    { titulo: "Nota", ancho: 102 },
  ];

  if (datos.movimientos.length === 0) {
    pagina.drawText("Sin movimientos registrados.", { x: MARGEN, y, size: 9, font: regular, color: GRIS });
    y -= 16;
  } else {
    encabezadoTabla(colsMov);
    for (const m of datos.movimientos) {
      filaTabla(colsMov, [
        formatearFechaHora(m.fecha),
        `${m.itemCodigo} · ${m.itemNombre}`,
        m.tipo,
        m.cantidad,
        String(m.stock),
        m.persona ?? "—",
        m.registro,
        m.nota ?? "—",
      ]);
    }
  }

  // Numeración de páginas.
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    const t = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(t, {
      x: ANCHO - MARGEN - regular.widthOfTextAtSize(t, 7),
      y: 22,
      size: 7,
      font: regular,
      color: GRIS,
    });
  });

  return pdf.save();
}
