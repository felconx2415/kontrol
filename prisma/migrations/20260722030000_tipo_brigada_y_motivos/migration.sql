-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Brigada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'EMPRESA',
    "supervisorId" TEXT,
    CONSTRAINT "Brigada_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Brigada" ("id", "nombre", "supervisorId") SELECT "id", "nombre", "supervisorId" FROM "Brigada";
DROP TABLE "Brigada";
ALTER TABLE "new_Brigada" RENAME TO "Brigada";
CREATE UNIQUE INDEX "Brigada_nombre_key" ON "Brigada"("nombre");
CREATE TABLE "new_SolicitudItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitudId" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "motivo" TEXT,
    "detalleReemplazo" TEXT,
    "fotoEvidenciaUrl" TEXT,
    "entregaAnteriorItemId" TEXT,
    CONSTRAINT "SolicitudItem_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SolicitudItem_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitudItem_entregaAnteriorItemId_fkey" FOREIGN KEY ("entregaAnteriorItemId") REFERENCES "EntregaItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SolicitudItem" ("articuloId", "cantidad", "detalleReemplazo", "entregaAnteriorItemId", "fotoEvidenciaUrl", "id", "solicitudId") SELECT "articuloId", "cantidad", "detalleReemplazo", "entregaAnteriorItemId", "fotoEvidenciaUrl", "id", "solicitudId" FROM "SolicitudItem";
DROP TABLE "SolicitudItem";
ALTER TABLE "new_SolicitudItem" RENAME TO "SolicitudItem";
CREATE UNIQUE INDEX "SolicitudItem_entregaAnteriorItemId_key" ON "SolicitudItem"("entregaAnteriorItemId");
CREATE INDEX "SolicitudItem_solicitudId_idx" ON "SolicitudItem"("solicitudId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

