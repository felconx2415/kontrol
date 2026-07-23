-- CreateTable
CREATE TABLE "AsignacionBodega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "notas" TEXT,
    "asignadoPorId" TEXT NOT NULL,
    "asignadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsignacionBodega_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemBodega" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsignacionBodega_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsignacionBodega_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AsignacionBodega_usuarioId_idx" ON "AsignacionBodega"("usuarioId");

-- CreateIndex
CREATE INDEX "AsignacionBodega_itemId_idx" ON "AsignacionBodega"("itemId");

