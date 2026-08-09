import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

/**
 * Escenario de prueba para la separación por empresa.
 *
 * Con una sola empresa el aislamiento no se ve: todo el mundo alcanza todo y
 * cualquier pantalla parece correcta. Esto crea una **segunda** empresa con su
 * propia gente, sus solicitudes y su bodega, para poder comprobar de verdad
 * quién ve qué.
 *
 * Deja tres cuentas que cubren los tres casos de alcance:
 *   gestorsur    → una sola empresa (Forestal Sur)
 *   multigestor  → las dos a la vez
 *   admin        → todas, sin pertenecer a ninguna
 *
 * Reejecutable: cada corrida **reinicia** las solicitudes de Forestal Sur a su
 * estado de partida. Sin eso, probar dos veces seguidas no sirve —la primera
 * aprueba y entrega, y la segunda ya no encuentra nada en esas etapas—. Las
 * cuentas, la brigada y la bodega se conservan.
 */
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

const PASS = "kontrol123";

/** Artículos reales del codigario, uno de cada origen de reserva. */
const COD_ALMACEN = "70035100"; // casco — reserva que entrega el almacén
const COD_RESERVA_PROPIA = "55400050"; // secuenciómetro — reserva del gestor

async function siguienteFolio() {
  const c = await db.contador.upsert({
    where: { nombre: "solicitud" },
    create: { nombre: "solicitud", valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return c.valor;
}

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);

async function main() {
  const pass = await bcrypt.hash(PASS, 10);

  const principal = await db.empresa.findFirstOrThrow({
    where: { nombre: "Empresa principal" },
  });

  const sur = await db.empresa.upsert({
    where: { nombre: "Forestal Sur" },
    create: { nombre: "Forestal Sur", rut: "76.543.210-K" },
    update: {},
  });

  const brigadaCosta = await db.brigada.upsert({
    where: { empresaId_nombre: { empresaId: sur.id, nombre: "Brigada Costa" } },
    create: { nombre: "Brigada Costa", empresaId: sur.id, tipo: "CONTRATISTA" },
    update: {},
  });

  // ── Cuentas ─────────────────────────────────────────────────────────────
  const cuentas = [
    {
      username: "gestorsur",
      nombre: "Andrea Vidal",
      rol: "GESTOR" as const,
      empresaId: sur.id,
      brigadaId: null,
      // Solo Forestal Sur: es el caso de una empresa.
      gestiona: [sur.id],
    },
    {
      username: "multigestor",
      nombre: "Rodrigo Paz",
      rol: "GESTOR" as const,
      empresaId: principal.id,
      brigadaId: null,
      // Las dos a la vez: es el caso que pediste.
      gestiona: [principal.id, sur.id],
    },
    {
      username: "aprobadorsur",
      nombre: "Claudia Reyes",
      rol: "APROBADOR" as const,
      empresaId: sur.id,
      brigadaId: brigadaCosta.id,
      gestiona: [],
    },
    {
      username: "rlagos",
      nombre: "Rubén Lagos",
      rol: "SOLICITANTE" as const,
      empresaId: sur.id,
      brigadaId: brigadaCosta.id,
      gestiona: [],
    },
    {
      username: "tmella",
      nombre: "Tamara Mella",
      rol: "SOLICITANTE" as const,
      empresaId: sur.id,
      brigadaId: brigadaCosta.id,
      gestiona: [],
    },
  ];

  for (const c of cuentas) {
    await db.usuario.upsert({
      where: { username: c.username },
      create: {
        username: c.username,
        nombre: c.nombre,
        rol: c.rol,
        empresaId: c.empresaId,
        brigadaId: c.brigadaId,
        passwordHash: pass,
        empresasGestionadas: { connect: c.gestiona.map((id) => ({ id })) },
      },
      update: {
        nombre: c.nombre,
        rol: c.rol,
        empresaId: c.empresaId,
        brigadaId: c.brigadaId,
        empresasGestionadas: { set: c.gestiona.map((id) => ({ id })) },
      },
    });
  }

  await db.brigada.update({
    where: { id: brigadaCosta.id },
    data: {
      supervisorId: (
        await db.usuario.findUniqueOrThrow({ where: { username: "aprobadorsur" } })
      ).id,
    },
  });

  // ── Bodega propia de Forestal Sur ───────────────────────────────────────
  // Mismo código que podría existir en la otra empresa: el aislamiento tiene
  // que permitirlo sin chocar.
  const yaEnBodega = await db.itemBodega.findFirst({
    where: { empresaId: sur.id, codigo: "HER-01" },
  });
  if (!yaEnBodega) {
    await db.itemBodega.create({
      data: {
        codigo: "HER-01",
        nombre: "Motosierra Stihl MS 250",
        categoria: "Herramientas",
        ubicacion: "Estante A2",
        stock: 4,
        empresaId: sur.id,
      },
    });
  }

  // ── Solicitudes en distintas etapas ─────────────────────────────────────
  const [ruben, tamara, gestorSur, aprobadorSur] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { username: "rlagos" } }),
    db.usuario.findUniqueOrThrow({ where: { username: "tmella" } }),
    db.usuario.findUniqueOrThrow({ where: { username: "gestorsur" } }),
    db.usuario.findUniqueOrThrow({ where: { username: "aprobadorsur" } }),
  ]);

  const [artAlmacen, artPropia] = await Promise.all([
    db.articulo.findUniqueOrThrow({ where: { codigo: COD_ALMACEN } }),
    db.articulo.findUniqueOrThrow({ where: { codigo: COD_RESERVA_PROPIA } }),
  ]);

  // Se borra lo transaccional de la empresa y se vuelve a sembrar, para que
  // cada corrida parta del mismo estado. Solo toca Forestal Sur: los datos de
  // la otra empresa no se rozan.
  const previas = await db.solicitud.findMany({
    where: { empresaId: sur.id },
    select: { id: true },
  });
  const ids = previas.map((s) => s.id);

  if (ids.length > 0) {
    await db.$transaction(async (tx) => {
      await tx.entregaItem.deleteMany({
        where: { entrega: { solicitudId: { in: ids } } },
      });
      await tx.entrega.deleteMany({ where: { solicitudId: { in: ids } } });
      // SolicitudItem cae por cascada al borrar la solicitud.
      await tx.solicitud.deleteMany({ where: { id: { in: ids } } });
    });
  }

  // Y la campana vuelve a cero para la gente de esta empresa.
  await db.notificacion.deleteMany({
    where: { usuario: { empresaId: sur.id } },
  });

  {
    // 1. PENDIENTE — para probar aprobación y el aviso al aprobador.
    await db.solicitud.create({
      data: {
        folio: await siguienteFolio(),
        solicitanteId: ruben.id,
        brigadaId: brigadaCosta.id,
        empresaId: sur.id,
        tipo: "NUEVO",
        estado: "PENDIENTE",
        justificacion: "Incorporación a la cuadrilla de poda.",
        creadaEn: hace(3),
        enviadaEn: hace(3),
        items: {
          create: [
            { articuloId: artAlmacen.id, cantidad: 1, motivo: "NUEVA_INCORPORACION" },
          ],
        },
      },
    });

    // 2. APROBADA con líneas de los DOS orígenes de reserva — es la que sirve
    //    para probar el formulario de reservas con números distintos.
    await db.solicitud.create({
      data: {
        folio: await siguienteFolio(),
        solicitanteId: tamara.id,
        brigadaId: brigadaCosta.id,
        empresaId: sur.id,
        tipo: "NUEVO",
        estado: "APROBADA",
        justificacion: "Equipamiento de temporada.",
        creadaEn: hace(6),
        enviadaEn: hace(6),
        aprobadorId: aprobadorSur.id,
        aprobadaEn: hace(4),
        items: {
          create: [
            { articuloId: artAlmacen.id, cantidad: 2, motivo: "PRIMERA_VEZ" },
            { articuloId: artPropia.id, cantidad: 1, motivo: "PRIMERA_VEZ" },
            { articuloId: artPropia.id, cantidad: 3, motivo: "PRIMERA_VEZ" },
          ],
        },
      },
    });

    // 3. RECIBIDA — lista para entregar, que es donde se prueba que reciba
    //    otra persona.
    await db.solicitud.create({
      data: {
        folio: await siguienteFolio(),
        solicitanteId: ruben.id,
        brigadaId: brigadaCosta.id,
        empresaId: sur.id,
        tipo: "NUEVO",
        estado: "RECIBIDA",
        justificacion: "Reposición de casco.",
        creadaEn: hace(10),
        enviadaEn: hace(10),
        aprobadorId: aprobadorSur.id,
        aprobadaEn: hace(9),
        gestorId: gestorSur.id,
        enGestionEn: hace(7),
        recibidaEn: hace(1),
        items: {
          create: [
            {
              articuloId: artAlmacen.id,
              cantidad: 1,
              cantidadRecibida: 1,
              motivo: "NUEVA_INCORPORACION",
              numeroReserva: "4500778899",
            },
          ],
        },
      },
    });
  }

  const totalSur = await db.solicitud.count({ where: { empresaId: sur.id } });
  console.log(`Listo. «Forestal Sur» con ${totalSur} solicitudes y 5 cuentas.`);
  console.log(`Contraseña de todas: ${PASS}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
