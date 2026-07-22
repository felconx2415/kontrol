import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

/**
 * Seed de arranque: deja el sistema listo para operar en limpio, sin datos de
 * ejemplo. Solo crea una cuenta ADMIN para poder entrar y desde ahí dar de
 * alta usuarios, brigadas y bodega reales.
 *
 * El catálogo de artículos NO se siembra aquí: se carga desde el codigario con
 *   npm run db:import
 *
 * Credenciales configurables por entorno (con valores por defecto):
 *   ADMIN_USERNAME (admin)  ADMIN_PASSWORD (kontrol123)  ADMIN_NOMBRE (Administrador)
 */
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const nombre = process.env.ADMIN_NOMBRE ?? "Administrador";
  const password = process.env.ADMIN_PASSWORD ?? "kontrol123";

  await db.usuario.upsert({
    where: { username },
    create: { username, nombre, rol: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    // No pisa la contraseña si la cuenta ya existe: reseed no revierte cambios.
    update: { nombre, rol: "ADMIN" },
  });

  console.log(`Listo: cuenta ADMIN «${username}» disponible.`);
  if (password === "kontrol123") {
    console.log("Contraseña por defecto: kontrol123 — cámbiala tras el primer ingreso.");
  }
  console.log("Carga el catálogo con: npm run db:import");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
