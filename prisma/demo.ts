/**
 * Datos de demostración para ver el escritorio con contenido realista.
 *
 * Genera entregas ya firmadas con fechas retroactivas, de modo que los
 * vencimientos caigan repartidos: algunos vencidos, otros dentro de los 30
 * días y el resto a lo largo de los próximos meses. También deja solicitudes
 * detenidas en cada etapa del flujo para poblar el embudo.
 *
 * Es aditivo y se puede volver a ejecutar. Para partir de cero:
 *   npx prisma migrate reset --schema=prisma/schema.prisma && npm run db:demo
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);

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
  talla?: string;
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
          talla: articulo.requiereTalla ? (params.talla ?? "M") : null,
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
          talla: articulo.requiereTalla ? "L" : null,
        },
      },
    },
  });
}

async function main() {
  console.log("Generando datos de demostración…");

  // Vencimientos repartidos. La vida útil de cada artículo (en el seed)
  // determina a cuántos días vence; se ajusta el "hace" para repartirlos.
  const historicas: { username: string; codigoArticulo: string; diasAtras: number; talla?: string }[] = [
    // Guantes (180 d de vida útil) → vencidos y por vencer
    { username: "jperez", codigoArticulo: "EPP-002", diasAtras: 200, talla: "M" },
    { username: "msoto", codigoArticulo: "EPP-002", diasAtras: 195, talla: "S" },
    { username: "pmunoz", codigoArticulo: "EPP-002", diasAtras: 170, talla: "L" },
    { username: "msoto", codigoArticulo: "EPP-009", diasAtras: 95 }, // filtro 90 d → vencido
    { username: "pmunoz", codigoArticulo: "EPP-009", diasAtras: 75 }, // vence en 15 d
    // Botas y chalecos (365 d) → repartidos en los próximos meses
    { username: "msoto", codigoArticulo: "EPP-003", diasAtras: 350, talla: "38" },
    { username: "pmunoz", codigoArticulo: "EPP-003", diasAtras: 320, talla: "44" },
    { username: "jperez", codigoArticulo: "EPP-010", diasAtras: 300, talla: "M" },
    { username: "msoto", codigoArticulo: "EPP-010", diasAtras: 260, talla: "S" },
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
