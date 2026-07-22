-- CreateTable
CREATE TABLE "ItemBodega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'General',
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "ubicacion" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MovimientoBodega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockResultante" INTEGER NOT NULL,
    "persona" TEXT,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "prestamoId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoBodega_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemBodega" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MovimientoBodega_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoBodega_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prestamo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "persona" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "prestadoPorId" TEXT NOT NULL,
    "prestadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "devueltoEn" DATETIME,
    CONSTRAINT "Prestamo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemBodega" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prestamo_prestadoPorId_fkey" FOREIGN KEY ("prestadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemBodega_codigo_key" ON "ItemBodega"("codigo");

-- CreateIndex
CREATE INDEX "ItemBodega_activo_idx" ON "ItemBodega"("activo");

-- CreateIndex
CREATE INDEX "MovimientoBodega_itemId_idx" ON "MovimientoBodega"("itemId");

-- CreateIndex
CREATE INDEX "MovimientoBodega_creadoEn_idx" ON "MovimientoBodega"("creadoEn");

-- CreateIndex
CREATE INDEX "Prestamo_estado_idx" ON "Prestamo"("estado");

-- CreateIndex
CREATE INDEX "Prestamo_itemId_idx" ON "Prestamo"("itemId");
