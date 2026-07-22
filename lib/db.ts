import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 exige un driver adapter explícito; ya no trae motor propio.
function crearCliente() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// En desarrollo Next recarga los módulos en cada cambio; sin este singleton
// se acumularían conexiones abiertas a SQLite.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof crearCliente> | undefined;
};

export const db = globalForPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
