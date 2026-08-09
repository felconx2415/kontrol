-- CreateTable
CREATE TABLE "TokenApi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "empresaId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEn" DATETIME,
    "revocadoEn" DATETIME,
    CONSTRAINT "TokenApi_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TokenApi_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenApi_prefijo_key" ON "TokenApi"("prefijo");

-- CreateIndex
CREATE UNIQUE INDEX "TokenApi_hash_key" ON "TokenApi"("hash");

-- CreateIndex
CREATE INDEX "TokenApi_empresaId_idx" ON "TokenApi"("empresaId");
