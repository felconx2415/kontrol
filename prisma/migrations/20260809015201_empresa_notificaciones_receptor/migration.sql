/*
  Separación por empresa, notificaciones y receptor distinto al destinatario.

  Lo que ya estaba operando nació sin empresa, así que esta migración crea una
  —«Empresa principal»— y le traspasa todo: usuarios, brigadas, solicitudes y
  bodega. Es un id literal y no un cuid generado porque el mismo valor tiene que
  servir en los seis backfills de más abajo. El admin la renombra después con
  el nombre real y crea las demás.

  Los gestores que ya existían quedan asignados a esa empresa para que sigan
  viendo exactamente lo mismo que ayer: la migración separa los datos, no
  revoca accesos.
*/

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Empresa de arranque para los datos previos a la separación. Solo se crea si
-- hay algo que traspasar: en una base nueva no aparece.
INSERT INTO "Empresa" ("id", "nombre", "creadaEn")
SELECT 'empresa-inicial', 'Empresa principal', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Usuario");

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "url" TEXT,
    "leidaEn" DATETIME,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_GestoresEmpresa" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GestoresEmpresa_A_fkey" FOREIGN KEY ("A") REFERENCES "Empresa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GestoresEmpresa_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Brigada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'EMPRESA',
    "empresaId" TEXT NOT NULL,
    "supervisorId" TEXT,
    CONSTRAINT "Brigada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Brigada_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Brigada" ("id", "nombre", "supervisorId", "tipo", "empresaId") SELECT "id", "nombre", "supervisorId", "tipo", 'empresa-inicial' FROM "Brigada";
DROP TABLE "Brigada";
ALTER TABLE "new_Brigada" RENAME TO "Brigada";
CREATE UNIQUE INDEX "Brigada_empresaId_nombre_key" ON "Brigada"("empresaId", "nombre");
CREATE TABLE "new_Entrega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitudId" TEXT NOT NULL,
    "receptorId" TEXT NOT NULL,
    "entregadoPorId" TEXT NOT NULL,
    "entregadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firmaPngUrl" TEXT NOT NULL,
    "observaciones" TEXT,
    "actaPdfUrl" TEXT,
    "recibidoPorId" TEXT,
    "recibidoPorNombre" TEXT,
    "recibidoPorRut" TEXT,
    CONSTRAINT "Entrega_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entrega_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entrega_entregadoPorId_fkey" FOREIGN KEY ("entregadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entrega_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Entrega" ("actaPdfUrl", "entregadaEn", "entregadoPorId", "firmaPngUrl", "id", "observaciones", "receptorId", "solicitudId") SELECT "actaPdfUrl", "entregadaEn", "entregadoPorId", "firmaPngUrl", "id", "observaciones", "receptorId", "solicitudId" FROM "Entrega";
DROP TABLE "Entrega";
ALTER TABLE "new_Entrega" RENAME TO "Entrega";
CREATE UNIQUE INDEX "Entrega_solicitudId_key" ON "Entrega"("solicitudId");
CREATE INDEX "Entrega_receptorId_idx" ON "Entrega"("receptorId");
CREATE TABLE "new_ItemBodega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'General',
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "ubicacion" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemBodega_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ItemBodega" ("activo", "categoria", "codigo", "creadoEn", "id", "nombre", "notas", "stock", "ubicacion", "unidad", "empresaId") SELECT "activo", "categoria", "codigo", "creadoEn", "id", "nombre", "notas", "stock", "ubicacion", "unidad", 'empresa-inicial' FROM "ItemBodega";
DROP TABLE "ItemBodega";
ALTER TABLE "new_ItemBodega" RENAME TO "ItemBodega";
CREATE INDEX "ItemBodega_activo_idx" ON "ItemBodega"("activo");
CREATE INDEX "ItemBodega_empresaId_idx" ON "ItemBodega"("empresaId");
CREATE UNIQUE INDEX "ItemBodega_empresaId_codigo_key" ON "ItemBodega"("empresaId", "codigo");
CREATE TABLE "new_Solicitud" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folio" INTEGER NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "brigadaId" TEXT,
    "empresaId" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "justificacion" TEXT,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadaPorId" TEXT,
    "enviadaEn" DATETIME,
    "aprobadorId" TEXT,
    "aprobadaEn" DATETIME,
    "motivoRechazo" TEXT,
    "editadaEn" DATETIME,
    "editadaPorId" TEXT,
    "gestorId" TEXT,
    "pedidoExternoRef" TEXT,
    "reservaSolicitadaEn" DATETIME,
    "enGestionEn" DATETIME,
    "recibidaEn" DATETIME,
    "canceladaEn" DATETIME,
    CONSTRAINT "Solicitud_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_editadaPorId_fkey" FOREIGN KEY ("editadaPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_brigadaId_fkey" FOREIGN KEY ("brigadaId") REFERENCES "Brigada" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Solicitud" ("aprobadaEn", "aprobadorId", "brigadaId", "canceladaEn", "creadaEn", "creadaPorId", "editadaEn", "editadaPorId", "enGestionEn", "enviadaEn", "estado", "folio", "gestorId", "id", "justificacion", "motivoRechazo", "pedidoExternoRef", "recibidaEn", "reservaSolicitadaEn", "solicitanteId", "tipo", "empresaId") SELECT "aprobadaEn", "aprobadorId", "brigadaId", "canceladaEn", "creadaEn", "creadaPorId", "editadaEn", "editadaPorId", "enGestionEn", "enviadaEn", "estado", "folio", "gestorId", "id", "justificacion", "motivoRechazo", "pedidoExternoRef", "recibidaEn", "reservaSolicitadaEn", "solicitanteId", "tipo", 'empresa-inicial' FROM "Solicitud";
DROP TABLE "Solicitud";
ALTER TABLE "new_Solicitud" RENAME TO "Solicitud";
CREATE UNIQUE INDEX "Solicitud_folio_key" ON "Solicitud"("folio");
CREATE INDEX "Solicitud_estado_idx" ON "Solicitud"("estado");
CREATE INDEX "Solicitud_solicitanteId_idx" ON "Solicitud"("solicitanteId");
CREATE INDEX "Solicitud_empresaId_estado_idx" ON "Solicitud"("empresaId", "estado");
CREATE TABLE "new_Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'SOLICITANTE',
    "firmaPngUrl" TEXT,
    "brigadaId" TEXT,
    "empresaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Usuario_brigadaId_fkey" FOREIGN KEY ("brigadaId") REFERENCES "Brigada" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Usuario" ("activo", "brigadaId", "creadoEn", "firmaPngUrl", "id", "nombre", "passwordHash", "rol", "rut", "username", "empresaId") SELECT "activo", "brigadaId", "creadoEn", "firmaPngUrl", "id", "nombre", "passwordHash", "rol", "rut", "username", 'empresa-inicial' FROM "Usuario";
DROP TABLE "Usuario";
ALTER TABLE "new_Usuario" RENAME TO "Usuario";
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nombre_key" ON "Empresa"("nombre");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leidaEn_idx" ON "Notificacion"("usuarioId", "leidaEn");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_creadaEn_idx" ON "Notificacion"("usuarioId", "creadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "_GestoresEmpresa_AB_unique" ON "_GestoresEmpresa"("A", "B");

-- CreateIndex
CREATE INDEX "_GestoresEmpresa_B_index" ON "_GestoresEmpresa"("B");

-- Los gestores que ya operaban pasan a atender la empresa de arranque. Sin
-- esto su alcance quedaría vacío y dejarían de ver las solicitudes que venían
-- gestionando: la separación por empresa no debe estrenarse quitando accesos.
INSERT INTO "_GestoresEmpresa" ("A", "B")
SELECT 'empresa-inicial', "id" FROM "Usuario" WHERE "rol" = 'GESTOR';
