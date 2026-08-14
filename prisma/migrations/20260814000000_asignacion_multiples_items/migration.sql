-- Una asignación pasa de tener un ítem a tener varias líneas, igual que el
-- préstamo. Las asignaciones existentes se conservan: cada una se convierte en
-- una línea de sí misma, así que sus actas y sus códigos QR siguen valiendo.

-- CreateTable
CREATE TABLE "AsignacionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asignacionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "numeroSerie" TEXT,
    CONSTRAINT "AsignacionItem_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "AsignacionBodega" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsignacionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemBodega" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Traslada cada asignación existente a su línea.
INSERT INTO "AsignacionItem" ("id", "asignacionId", "itemId", "cantidad", "numeroSerie")
SELECT
    lower(hex(randomblob(16))),
    "id",
    "itemId",
    "cantidad",
    "numeroSerie"
FROM "AsignacionBodega";

-- CreateIndex
CREATE INDEX "AsignacionItem_asignacionId_idx" ON "AsignacionItem"("asignacionId");
CREATE INDEX "AsignacionItem_itemId_idx" ON "AsignacionItem"("itemId");

-- RedefineTables: AsignacionBodega pierde itemId, cantidad y numeroSerie.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AsignacionBodega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "notas" TEXT,
    "asignadoPorId" TEXT NOT NULL,
    "asignadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firmaPngUrl" TEXT,
    CONSTRAINT "AsignacionBodega_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsignacionBodega_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AsignacionBodega" ("id", "usuarioId", "notas", "asignadoPorId", "asignadoEn", "firmaPngUrl")
SELECT "id", "usuarioId", "notas", "asignadoPorId", "asignadoEn", "firmaPngUrl" FROM "AsignacionBodega";
DROP TABLE "AsignacionBodega";
ALTER TABLE "new_AsignacionBodega" RENAME TO "AsignacionBodega";
CREATE INDEX "AsignacionBodega_usuarioId_idx" ON "AsignacionBodega"("usuarioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
