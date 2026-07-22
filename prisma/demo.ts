/**
 * Datos de demostración para ver el escritorio con contenido realista.
 *
 * Genera entregas ya firmadas con fechas retroactivas, de modo que los
 * vencimientos caigan repartidos: algunos vencidos, otros dentro de los 30
 * días y el resto a lo largo de los próximos meses. También deja solicitudes
 * detenidas en cada etapa del flujo para poblar el embudo.
 *
 * Es autosuficiente: crea sus propias brigadas, usuarios y artículos de
 * ejemplo (el seed normal solo deja la cuenta admin). Es aditivo y se puede
 * volver a ejecutar. Para partir de cero:
 *   npx prisma migrate reset --schema=prisma/schema.prisma && npm run db:demo
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);

// Artículos de ejemplo que usan las solicitudes de demostración. Sus códigos
// (EPP-00x / EQ-00x) no chocan con el codigario real, que es numérico.
const ARTICULOS_DEMO = [
  { codigo: "EPP-001", nombre: "Casco de seguridad", categoria: "EPP", vidaUtilDias: 1825 },
  { codigo: "EPP-002", nombre: "Guantes de cuero", categoria: "EPP", vidaUtilDias: 180 },
  { codigo: "EPP-003", nombre: "Botas de seguridad", categoria: "EPP", vidaUtilDias: 365 },
  { codigo: "EPP-004", nombre: "Antiparras", categoria: "EPP", vidaUtilDias: 730 },
  { codigo: "EPP-005", nombre: "Protector auditivo", categoria: "EPP", vidaUtilDias: 365 },
  { codigo: "EPP-006", nombre: "Arnés de seguridad", categoria: "EPP", vidaUtilDias: 1825 },
  { codigo: "EPP-007", nombre: "Buzo ignífugo", categoria: "EPP", vidaUtilDias: 730 },
  { codigo: "EPP-008", nombre: "Mascarilla media cara", categoria: "EPP", vidaUtilDias: 365 },
  { codigo: "EPP-009", nombre: "Filtro para mascarilla", categoria: "EPP", vidaUtilDias: 90 },
  { codigo: "EPP-010", nombre: "Chaleco reflectante", categoria: "EPP", vidaUtilDias: 365 },
  { codigo: "EQ-001", nombre: "Radio portátil VHF", categoria: "EQUIPAMIENTO", vidaUtilDias: null },
  { codigo: "EQ-003", nombre: "Motosierra", categoria: "EQUIPAMIENTO", vidaUtilDias: null },
  { codigo: "EQ-005", nombre: "Mochila forestal 20L", categoria: "EQUIPAMIENTO", vidaUtilDias: null },
  { codigo: "EQ-007", nombre: "Botiquín de primeros auxilios", categoria: "EQUIPAMIENTO", vidaUtilDias: 365 },
] as const;

/**
 * Crea las brigadas, usuarios y artículos que las solicitudes de demo
 * necesitan. Idempotente (upsert), para poder reejecutar db:demo.
 */
async function prepararBase() {
  const pass = await bcrypt.hash("kontrol123", 10);

  const brigadaNorte = await db.brigada.upsert({
    where: { nombre: "Brigada Norte" },
    create: { nombre: "Brigada Norte" },
    update: {},
  });
  const brigadaSur = await db.brigada.upsert({
    where: { nombre: "Brigada Sur" },
    create: { nombre: "Brigada Sur" },
    update: {},
  });

  const usuarios = [
    { username: "gestor", nombre: "Camila Rojas", rol: "GESTOR" as const, brigadaId: null },
    { username: "aprobador", nombre: "Luis Fuentes", rol: "APROBADOR" as const, brigadaId: brigadaNorte.id },
    { username: "jperez", nombre: "Juan Pérez", rol: "SOLICITANTE" as const, brigadaId: brigadaNorte.id },
    { username: "msoto", nombre: "María Soto", rol: "SOLICITANTE" as const, brigadaId: brigadaNorte.id },
    { username: "pmunoz", nombre: "Pedro Muñoz", rol: "SOLICITANTE" as const, brigadaId: brigadaSur.id },
  ];
  for (const u of usuarios) {
    await db.usuario.upsert({
      where: { username: u.username },
      create: { ...u, passwordHash: pass },
      update: { nombre: u.nombre, rol: u.rol, brigadaId: u.brigadaId },
    });
  }

  const aprobador = await db.usuario.findUniqueOrThrow({ where: { username: "aprobador" } });
  await db.brigada.update({ where: { id: brigadaNorte.id }, data: { supervisorId: aprobador.id } });

  for (const a of ARTICULOS_DEMO) {
    await db.articulo.upsert({
      where: { codigo: a.codigo },
      create: a,
      update: { nombre: a.nombre, vidaUtilDias: a.vidaUtilDias },
    });
  }
}

async function siguienteFolio() {
  const c = await db.contador.upsert({
    where: { nombre: "solicitud" },
    create: { nombre: "solicitud", valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return c.valor;
}

/**
 * Crea una solicitud ya entregada, fechada hacia atrás.
 * `diasAtras` controla dónde cae el vencimiento: entregado hace mucho ⇒
 * vence antes.
 */
async function entregaHistorica(params: {
  username: string;
  codigoArticulo: string;
  diasAtras: number;
}) {
  const [solicitante, gestor, articulo] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { username: params.username } }),
    db.usuario.findUniqueOrThrow({ where: { username: "gestor" } }),
    db.articulo.findUniqueOrThrow({ where: { codigo: params.codigoArticulo } }),
  ]);

  const entregadaEn = hace(params.diasAtras);
  const venceEn = articulo.vidaUtilDias
    ? new Date(entregadaEn.getTime() + articulo.vidaUtilDias * 86_400_000)
    : null;

  const solicitud = await db.solicitud.create({
    data: {
      folio: await siguienteFolio(),
      solicitanteId: solicitante.id,
      brigadaId: solicitante.brigadaId,
      tipo: "NUEVO",
      estado: "ENTREGADA",
      justificacion: "Entrega de temporada.",
      creadaEn: hace(params.diasAtras + 6),
      enviadaEn: hace(params.diasAtras + 6),
      aprobadaEn: hace(params.diasAtras + 4),
      enGestionEn: hace(params.diasAtras + 3),
      recibidaEn: hace(params.diasAtras + 1),
      items: {
        create: {
          articuloId: articulo.id,
          cantidad: 1,
        },
      },
    },
    include: { items: true },
  });

  const entrega = await db.entrega.create({
    data: {
      solicitudId: solicitud.id,
      receptorId: solicitante.id,
      entregadoPorId: gestor.id,
      entregadaEn,
      firmaPngUrl: "/uploads/firmas/demo.png",
      observaciones: null,
    },
  });

  await db.entregaItem.create({
    data: {
      entregaId: entrega.id,
      solicitudItemId: solicitud.items[0].id,
      cantidadEntregada: 1,
      venceEn,
    },
  });
}

/** Solicitud detenida en una etapa concreta, para poblar el embudo. */
async function solicitudEnEtapa(params: {
  username: string;
  codigoArticulo: string;
  estado: "PENDIENTE" | "APROBADA" | "EN_GESTION" | "RECIBIDA";
  diasAtras: number;
}) {
  const [solicitante, aprobador, gestor, articulo] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { username: params.username } }),
    db.usuario.findUniqueOrThrow({ where: { username: "aprobador" } }),
    db.usuario.findUniqueOrThrow({ where: { username: "gestor" } }),
    db.articulo.findUniqueOrThrow({ where: { codigo: params.codigoArticulo } }),
  ]);

  const avanzada = params.estado !== "PENDIENTE";

  await db.solicitud.create({
    data: {
      folio: await siguienteFolio(),
      solicitanteId: solicitante.id,
      brigadaId: solicitante.brigadaId,
      tipo: "NUEVO",
      estado: params.estado,
      justificacion: "Reposición solicitada por el jefe de cuadrilla.",
      creadaEn: hace(params.diasAtras),
      enviadaEn: hace(params.diasAtras),
      aprobadorId: avanzada ? aprobador.id : null,
      aprobadaEn: avanzada ? hace(params.diasAtras - 1) : null,
      gestorId: ["EN_GESTION", "RECIBIDA"].includes(params.estado) ? gestor.id : null,
      pedidoExternoRef:
        params.estado === "EN_GESTION" || params.estado === "RECIBIDA"
          ? `OC-2026-0${400 + params.diasAtras}`
          : null,
      enGestionEn: ["EN_GESTION", "RECIBIDA"].includes(params.estado)
        ? hace(params.diasAtras - 2)
        : null,
      recibidaEn: params.estado === "RECIBIDA" ? hace(1) : null,
      items: {
        create: {
          articuloId: articulo.id,
          cantidad: 1,
        },
      },
    },
  });
}

async function main() {
  console.log("Generando datos de demostración…");

  await prepararBase();

  // Vencimientos repartidos. La vida útil de cada artículo (en el seed)
  // determina a cuántos días vence; se ajusta el "hace" para repartirlos.
  const historicas: { username: string; codigoArticulo: string; diasAtras: number }[] = [
    // Guantes (180 d de vida útil) → vencidos y por vencer
    { username: "jperez", codigoArticulo: "EPP-002", diasAtras: 200 },
    { username: "msoto", codigoArticulo: "EPP-002", diasAtras: 195 },
    { username: "pmunoz", codigoArticulo: "EPP-002", diasAtras: 170 },
    { username: "msoto", codigoArticulo: "EPP-009", diasAtras: 95 }, // filtro 90 d → vencido
    { username: "pmunoz", codigoArticulo: "EPP-009", diasAtras: 75 }, // vence en 15 d
    // Botas y chalecos (365 d) → repartidos en los próximos meses
    { username: "msoto", codigoArticulo: "EPP-003", diasAtras: 350 },
    { username: "pmunoz", codigoArticulo: "EPP-003", diasAtras: 320 },
    { username: "jperez", codigoArticulo: "EPP-010", diasAtras: 300 },
    { username: "msoto", codigoArticulo: "EPP-010", diasAtras: 260 },
    { username: "pmunoz", codigoArticulo: "EPP-005", diasAtras: 230 },
    { username: "jperez", codigoArticulo: "EPP-005", diasAtras: 200 },
    { username: "msoto", codigoArticulo: "EQ-007", diasAtras: 190 },
  ];

  for (const h of historicas) await entregaHistorica(h);

  const enEtapa: {
    username: string;
    codigoArticulo: string;
    estado: "PENDIENTE" | "APROBADA" | "EN_GESTION" | "RECIBIDA";
    diasAtras: number;
  }[] = [
    { username: "msoto", codigoArticulo: "EPP-006", estado: "PENDIENTE", diasAtras: 9 },
    { username: "pmunoz", codigoArticulo: "EPP-001", estado: "PENDIENTE", diasAtras: 4 },
    { username: "jperez", codigoArticulo: "EPP-004", estado: "PENDIENTE", diasAtras: 1 },
    { username: "msoto", codigoArticulo: "EQ-001", estado: "APROBADA", diasAtras: 6 },
    { username: "pmunoz", codigoArticulo: "EQ-005", estado: "APROBADA", diasAtras: 3 },
    { username: "jperez", codigoArticulo: "EQ-003", estado: "EN_GESTION", diasAtras: 12 },
    { username: "msoto", codigoArticulo: "EPP-007", estado: "EN_GESTION", diasAtras: 5 },
    { username: "pmunoz", codigoArticulo: "EPP-008", estado: "RECIBIDA", diasAtras: 8 },
  ];

  for (const e of enEtapa) await solicitudEnEtapa(e);

  console.log(
    `Listo: ${historicas.length} entregas históricas y ${enEtapa.length} solicitudes en curso.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
