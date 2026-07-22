import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

const ARTICULOS = [
  { codigo: "EPP-001", nombre: "Casco de seguridad", categoria: "EPP", requiereTalla: false, vidaUtilDias: 1825 },
  { codigo: "EPP-002", nombre: "Guantes de cuero", categoria: "EPP", requiereTalla: true, vidaUtilDias: 180 },
  { codigo: "EPP-003", nombre: "Botas de seguridad", categoria: "EPP", requiereTalla: true, vidaUtilDias: 365 },
  { codigo: "EPP-004", nombre: "Antiparras", categoria: "EPP", requiereTalla: false, vidaUtilDias: 730 },
  { codigo: "EPP-005", nombre: "Protector auditivo", categoria: "EPP", requiereTalla: false, vidaUtilDias: 365 },
  { codigo: "EPP-006", nombre: "Arnés de seguridad", categoria: "EPP", requiereTalla: true, vidaUtilDias: 1825 },
  { codigo: "EPP-007", nombre: "Buzo ignífugo", categoria: "EPP", requiereTalla: true, vidaUtilDias: 730 },
  { codigo: "EPP-008", nombre: "Mascarilla media cara", categoria: "EPP", requiereTalla: true, vidaUtilDias: 365 },
  { codigo: "EPP-009", nombre: "Filtro para mascarilla", categoria: "EPP", requiereTalla: false, vidaUtilDias: 90 },
  { codigo: "EPP-010", nombre: "Chaleco reflectante", categoria: "EPP", requiereTalla: true, vidaUtilDias: 365 },
  { codigo: "EQ-001", nombre: "Radio portátil VHF", categoria: "EQUIPAMIENTO", requiereTalla: false, vidaUtilDias: null },
  { codigo: "EQ-002", nombre: "Linterna frontal", categoria: "EQUIPAMIENTO", requiereTalla: false, vidaUtilDias: null },
  { codigo: "EQ-003", nombre: "Motosierra", categoria: "EQUIPAMIENTO", requiereTalla: false, vidaUtilDias: null },
  { codigo: "EQ-004", nombre: "Batefuego", categoria: "EQUIPAMIENTO", requiereTalla: false, vidaUtilDias: null },
  { codigo: "EQ-005", nombre: "Mochila forestal 20L", categoria: "EQUIPAMIENTO", requiereTalla: false, vidaUtilDias: null },
  { codigo: "EQ-006", nombre: "GPS de mano", categoria: "EQUIPAMIENTO", requiereTalla: false, vidaUtilDias: null },
  { codigo: "EQ-007", nombre: "Botiquín de primeros auxilios", categoria: "EQUIPAMIENTO", requiereTalla: false, vidaUtilDias: 365 },
] as const;

async function main() {
  console.log("Sembrando datos de ejemplo…");

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
    { username: "admin", nombre: "Administrador", rol: "ADMIN" as const, brigadaId: null },
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

  // El aprobador supervisa la Brigada Norte.
  const aprobador = await db.usuario.findUniqueOrThrow({ where: { username: "aprobador" } });
  await db.brigada.update({
    where: { id: brigadaNorte.id },
    data: { supervisorId: aprobador.id },
  });

  for (const a of ARTICULOS) {
    await db.articulo.upsert({
      where: { codigo: a.codigo },
      create: a,
      update: { nombre: a.nombre, vidaUtilDias: a.vidaUtilDias, requiereTalla: a.requiereTalla },
    });
  }

  console.log(`Listo: ${usuarios.length} usuarios, 2 brigadas, ${ARTICULOS.length} artículos.`);
  console.log("Contraseña para todas las cuentas: kontrol123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
