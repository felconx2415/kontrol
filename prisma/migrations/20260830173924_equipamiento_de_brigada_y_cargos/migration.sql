/*
  El equipamiento de bodega deja de ser siempre de una persona.

  Dos cosas que el registro no sabía decir:

  - Hay material que es de la **brigada** —la motosierra, la carpa, el botiquín
    de la BBOO 2169— y no de ninguno de sus linieros. Ponerlo a nombre del que
    ese día fue a buscarlo lo hacía viajar con él al cambiar de cuadrilla, en el
    papel pero no en la realidad. `AsignacionBodega` pasa a tener dueño persona
    **o** brigada, y con ella los tres campos de quién retiró y firmó, porque una
    brigada no tiene manos.
  - Hay gente que no está en ninguna brigada y se distingue por su **cargo**:
    prevencionista de riesgo, jefe de zona. El cargo entra como catálogo y no
    como texto en la ficha porque su razón de ser es agrupar, y a mano la misma
    función acaba escrita de tres maneras.

  `usuarioId` se vuelve opcional; las asignaciones que ya existen conservan el
  suyo y siguen valiendo tal cual, con su acta y su código QR.
*/

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
-- El dueño va con RESTRICT y no con SET NULL: una asignación sin dueño no es un
-- registro degradado sino uno roto —stock que salió de bodega y un acta firmada
-- que no apunta a nadie—.
CREATE TABLE "new_AsignacionBodega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT,
    "brigadaId" TEXT,
    "notas" TEXT,
    "asignadoPorId" TEXT NOT NULL,
    "asignadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firmaPngUrl" TEXT,
    "retiradoPorId" TEXT,
    "retiradoPorNombre" TEXT,
    "retiradoPorRut" TEXT,
    CONSTRAINT "AsignacionBodega_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsignacionBodega_brigadaId_fkey" FOREIGN KEY ("brigadaId") REFERENCES "Brigada" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsignacionBodega_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsignacionBodega_retiradoPorId_fkey" FOREIGN KEY ("retiradoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AsignacionBodega" ("asignadoEn", "asignadoPorId", "firmaPngUrl", "id", "notas", "usuarioId") SELECT "asignadoEn", "asignadoPorId", "firmaPngUrl", "id", "notas", "usuarioId" FROM "AsignacionBodega";
DROP TABLE "AsignacionBodega";
ALTER TABLE "new_AsignacionBodega" RENAME TO "AsignacionBodega";
CREATE INDEX "AsignacionBodega_usuarioId_idx" ON "AsignacionBodega"("usuarioId");
CREATE INDEX "AsignacionBodega_brigadaId_idx" ON "AsignacionBodega"("brigadaId");
CREATE TABLE "new_Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'SOLICITANTE',
    "cargoId" TEXT,
    "firmaPngUrl" TEXT,
    "brigadaId" TEXT,
    "empresaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Usuario_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Usuario_brigadaId_fkey" FOREIGN KEY ("brigadaId") REFERENCES "Brigada" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Usuario" ("activo", "brigadaId", "creadoEn", "empresaId", "firmaPngUrl", "id", "nombre", "passwordHash", "rol", "rut", "username") SELECT "activo", "brigadaId", "creadoEn", "empresaId", "firmaPngUrl", "id", "nombre", "passwordHash", "rol", "rut", "username" FROM "Usuario";
DROP TABLE "Usuario";
ALTER TABLE "new_Usuario" RENAME TO "Usuario";
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");
CREATE INDEX "Usuario_cargoId_idx" ON "Usuario"("cargoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nombre_key" ON "Cargo"("nombre");
