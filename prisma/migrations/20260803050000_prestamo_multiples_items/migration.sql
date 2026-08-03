-- Un préstamo pasa de tener un ítem a tener varias líneas.
-- Los préstamos existentes se conservan: cada uno se convierte en una línea.

-- CreateTable
CREATE TABLE "PrestamoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prestamoId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "numeroSerie" TEXT,
    "devueltoEn" DATETIME,
    "estadoDevolucion" TEXT,
    "observacion" TEXT,
    "fotos" TEXT,
    CONSTRAINT "PrestamoItem_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrestamoItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemBodega" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Traslada cada préstamo existente a su línea. Lo ya devuelto se marca como
-- BUENO: es el único supuesto razonable, porque hasta ahora no se registraba
-- el estado de vuelta.
INSERT INTO "PrestamoItem" ("id", "prestamoId", "itemId", "cantidad", "numeroSerie", "devueltoEn", "estadoDevolucion")
SELECT
    lower(hex(randomblob(16))),
    "id",
    "itemId",
    "cantidad",
    "numeroSerie",
    "devueltoEn",
    CASE WHEN "devueltoEn" IS NOT NULL THEN 'BUENO' ELSE NULL END
FROM "Prestamo";

-- CreateIndex
CREATE INDEX "PrestamoItem_prestamoId_idx" ON "PrestamoItem"("prestamoId");
CREATE INDEX "PrestamoItem_itemId_idx" ON "PrestamoItem"("itemId");

-- RedefineTables: Prestamo pierde itemId, cantidad y numeroSerie.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Prestamo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "persona" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "prestadoPorId" TEXT NOT NULL,
    "prestadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "devueltoEn" DATETIME,
    "firmaSalidaUrl" TEXT,
    "firmaDevolucionUrl" TEXT,
    "observacionesDevolucion" TEXT,
    "fotosDevolucion" TEXT,
    CONSTRAINT "Prestamo_prestadoPorId_fkey" FOREIGN KEY ("prestadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Prestamo" ("id", "persona", "estado", "notas", "prestadoPorId", "prestadoEn", "devueltoEn", "firmaSalidaUrl", "firmaDevolucionUrl", "observacionesDevolucion", "fotosDevolucion")
SELECT "id", "persona", "estado", "notas", "prestadoPorId", "prestadoEn", "devueltoEn", "firmaSalidaUrl", "firmaDevolucionUrl", "observacionesDevolucion", "fotosDevolucion" FROM "Prestamo";
DROP TABLE "Prestamo";
ALTER TABLE "new_Prestamo" RENAME TO "Prestamo";
CREATE INDEX "Prestamo_estado_idx" ON "Prestamo"("estado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
