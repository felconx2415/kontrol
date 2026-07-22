-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Articulo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "vidaUtilDias" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Articulo" ("activo", "categoria", "codigo", "id", "nombre", "unidad", "vidaUtilDias") SELECT "activo", "categoria", "codigo", "id", "nombre", "unidad", "vidaUtilDias" FROM "Articulo";
DROP TABLE "Articulo";
ALTER TABLE "new_Articulo" RENAME TO "Articulo";
CREATE UNIQUE INDEX "Articulo_codigo_key" ON "Articulo"("codigo");
CREATE INDEX "Articulo_categoria_idx" ON "Articulo"("categoria");
CREATE TABLE "new_SolicitudItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitudId" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "motivoReemplazo" TEXT,
    "detalleReemplazo" TEXT,
    "fotoEvidenciaUrl" TEXT,
    "entregaAnteriorItemId" TEXT,
    CONSTRAINT "SolicitudItem_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SolicitudItem_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitudItem_entregaAnteriorItemId_fkey" FOREIGN KEY ("entregaAnteriorItemId") REFERENCES "EntregaItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SolicitudItem" ("articuloId", "cantidad", "detalleReemplazo", "entregaAnteriorItemId", "fotoEvidenciaUrl", "id", "motivoReemplazo", "solicitudId") SELECT "articuloId", "cantidad", "detalleReemplazo", "entregaAnteriorItemId", "fotoEvidenciaUrl", "id", "motivoReemplazo", "solicitudId" FROM "SolicitudItem";
DROP TABLE "SolicitudItem";
ALTER TABLE "new_SolicitudItem" RENAME TO "SolicitudItem";
CREATE UNIQUE INDEX "SolicitudItem_entregaAnteriorItemId_key" ON "SolicitudItem"("entregaAnteriorItemId");
CREATE INDEX "SolicitudItem_solicitudId_idx" ON "SolicitudItem"("solicitudId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

