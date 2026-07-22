-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Solicitud" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folio" INTEGER NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "brigadaId" TEXT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "justificacion" TEXT,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEn" DATETIME,
    "aprobadorId" TEXT,
    "aprobadaEn" DATETIME,
    "motivoRechazo" TEXT,
    "editadaEn" DATETIME,
    "editadaPorId" TEXT,
    "gestorId" TEXT,
    "pedidoExternoRef" TEXT,
    "enGestionEn" DATETIME,
    "recibidaEn" DATETIME,
    "canceladaEn" DATETIME,
    CONSTRAINT "Solicitud_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_editadaPorId_fkey" FOREIGN KEY ("editadaPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_brigadaId_fkey" FOREIGN KEY ("brigadaId") REFERENCES "Brigada" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Solicitud" ("aprobadaEn", "aprobadorId", "brigadaId", "canceladaEn", "creadaEn", "enGestionEn", "enviadaEn", "estado", "folio", "gestorId", "id", "justificacion", "motivoRechazo", "pedidoExternoRef", "recibidaEn", "solicitanteId", "tipo") SELECT "aprobadaEn", "aprobadorId", "brigadaId", "canceladaEn", "creadaEn", "enGestionEn", "enviadaEn", "estado", "folio", "gestorId", "id", "justificacion", "motivoRechazo", "pedidoExternoRef", "recibidaEn", "solicitanteId", "tipo" FROM "Solicitud";
DROP TABLE "Solicitud";
ALTER TABLE "new_Solicitud" RENAME TO "Solicitud";
CREATE UNIQUE INDEX "Solicitud_folio_key" ON "Solicitud"("folio");
CREATE INDEX "Solicitud_estado_idx" ON "Solicitud"("estado");
CREATE INDEX "Solicitud_solicitanteId_idx" ON "Solicitud"("solicitanteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
