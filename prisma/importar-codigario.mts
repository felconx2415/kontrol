/**
 * Carga el codigario oficial (Codigario.xlsx) en el catálogo de solicitudes
 * (tabla Articulo). Es idempotente: hace upsert por `codigo`, así que puede
 * volver a ejecutarse tras actualizar el Excel sin duplicar filas.
 *
 *   npm run db:import            # usa Codigario.xlsx en la raíz
 *   npm run db:import -- ruta.xlsx
 *
 * Mapeo de columnas del Excel → Articulo:
 *   CODIGO  → codigo        ITEM   → nombre        U/M → unidad
 *   ESTADO  → activo (ACTIVO ⇒ true)
 * La categoría se fija en EPP (el archivo no la trae) y requiereTalla en false
 * (cada talla ya es un código distinto).
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

// Unidades de medida del codigario → texto legible del catálogo.
const UNIDADES: Record<string, string> = {
  UN: "unidad",
  PAA: "par",
};

// Clasificación EPP vs EQUIPAMIENTO derivada del nombre. Se marca EQUIPAMIENTO
// lo que no es protección personal: herramientas, instrumentos, materiales de
// línea, pértigas, tierras, cubiertas, equipos de campo y señalización.
const EQUIP =
  /alicate|alikatro|destornillador|martillo|napole|marco de sierra|cortador|herramienta|tiracable|\btecle\b|polea|extractor|secuenci|ampermetro|telemetro|binocular|detector tensi|probador|\bllave\b|p[eé]rtiga|\btierra\b|cubertor|cubierta|manga diel|\bfunda\b|bolsa lona|estrobos diam|cuerda|perlon|\bperno\b|cadenas|\bconos?\b|motosierra|podador|antena|\bequipo\b|linterna|baliza|cinta peligro|letrero|candado|repelador|escalera/i;
// Estos ganan y se quedan EPP aunque el nombre matchee algo de arriba
// (protección contra caídas y posicionamiento personal).
const EPP_OVERRIDE = /seg lini|arn[eé]s de seg|dispositivo anti trauma|mensajero personal/i;

function categoriaDe(nombre: string): "EPP" | "EQUIPAMIENTO" {
  return EQUIP.test(nombre) && !EPP_OVERRIDE.test(nombre) ? "EQUIPAMIENTO" : "EPP";
}

/** Extrae el texto plano de una celda (maneja richText y fórmulas). */
function texto(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "object") {
    const v = valor as { text?: string; result?: unknown };
    if (typeof v.text === "string") return v.text;
    if (v.result != null) return String(v.result);
  }
  return String(valor);
}

async function main() {
  const archivo = process.argv[2] ?? "Codigario.xlsx";
  const ruta = path.resolve(process.cwd(), archivo);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const ws = wb.worksheets[0];

  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;

  // Recolecta primero para no mezclar E/S de Excel con la transacción.
  const filas: {
    codigo: string;
    nombre: string;
    unidad: string;
    categoria: "EPP" | "EQUIPAMIENTO";
    ceco: string | null;
    activo: boolean;
  }[] = [];

  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return; // encabezado
    const codigo = texto(row.getCell(1).value).trim().toUpperCase();
    const nombre = texto(row.getCell(2).value).trim();
    const um = texto(row.getCell(3).value).trim().toUpperCase();
    const ceco = texto(row.getCell(7).value).trim();
    const estado = texto(row.getCell(8).value).trim().toUpperCase();

    if (!codigo || !nombre) {
      omitidos++;
      return;
    }
    filas.push({
      codigo,
      nombre,
      unidad: UNIDADES[um] ?? um.toLowerCase() ?? "unidad",
      categoria: categoriaDe(nombre),
      ceco: ceco || null,
      activo: estado === "ACTIVO",
    });
  });

  let epp = 0;
  let equip = 0;
  for (const f of filas) {
    const existente = await db.articulo.findUnique({ where: { codigo: f.codigo } });
    await db.articulo.upsert({
      where: { codigo: f.codigo },
      create: {
        codigo: f.codigo,
        nombre: f.nombre,
        categoria: f.categoria,
        unidad: f.unidad,
        ceco: f.ceco,
        activo: f.activo,
      },
      // La categoría se deriva del nombre, así que el importador es su fuente de
      // verdad: se reescribe en cada carga (no se conserva un cambio manual).
      update: {
        nombre: f.nombre,
        unidad: f.unidad,
        categoria: f.categoria,
        ceco: f.ceco,
        activo: f.activo,
      },
    });
    if (existente) actualizados++;
    else creados++;
    if (f.categoria === "EQUIPAMIENTO") equip++;
    else epp++;
  }

  console.log(`Codigario: ${ruta}`);
  console.log(
    `Listo: ${creados} creados, ${actualizados} actualizados, ${omitidos} omitidos.`,
  );
  console.log(`Categorías: ${epp} EPP, ${equip} EQUIPAMIENTO.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
