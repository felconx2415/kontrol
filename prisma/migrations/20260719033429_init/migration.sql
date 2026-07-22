-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'SOLICITANTE',
    "brigadaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usuario_brigadaId_fkey" FOREIGN KEY ("brigadaId") REFERENCES "Brigada" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Brigada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "supervisorId" TEXT,
    CONSTRAINT "Brigada_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Articulo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "requiereTalla" BOOLEAN NOT NULL DEFAULT false,
    "vidaUtilDias" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Solicitud" (
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
    "gestorId" TEXT,
    "pedidoExternoRef" TEXT,
    "enGestionEn" DATETIME,
    "recibidaEn" DATETIME,
    "canceladaEn" DATETIME,
    CONSTRAINT "Solicitud_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Solicitud_brigadaId_fkey" FOREIGN KEY ("brigadaId") REFERENCES "Brigada" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SolicitudItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitudId" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "talla" TEXT,
    "motivoReemplazo" TEXT,
    "detalleReemplazo" TEXT,
    "fotoEvidenciaUrl" TEXT,
    "entregaAnteriorItemId" TEXT,
    CONSTRAINT "SolicitudItem_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SolicitudItem_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitudItem_entregaAnteriorItemId_fkey" FOREIGN KEY ("entregaAnteriorItemId") REFERENCES "EntregaItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitudId" TEXT NOT NULL,
    "receptorId" TEXT NOT NULL,
    "entregadoPorId" TEXT NOT NULL,
    "entregadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firmaPngUrl" TEXT NOT NULL,
    "observaciones" TEXT,
    "actaPdfUrl" TEXT,
    CONSTRAINT "Entrega_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entrega_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entrega_entregadoPorId_fkey" FOREIGN KEY ("entregadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntregaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entregaId" TEXT NOT NULL,
    "solicitudItemId" TEXT NOT NULL,
    "cantidadEntregada" INTEGER NOT NULL,
    "venceEn" DATETIME,
    "reemplazadoEn" DATETIME,
    CONSTRAINT "EntregaItem_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntregaItem_solicitudItemId_fkey" FOREIGN KEY ("solicitudItemId") REFERENCES "SolicitudItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalleJson" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contador" (
    "nombre" TEXT NOT NULL PRIMARY KEY,
    "valor" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "Brigada_nombre_key" ON "Brigada"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Articulo_codigo_key" ON "Articulo"("codigo");

-- CreateIndex
CREATE INDEX "Articulo_categoria_idx" ON "Articulo"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitud_folio_key" ON "Solicitud"("folio");

-- CreateIndex
CREATE INDEX "Solicitud_estado_idx" ON "Solicitud"("estado");

-- CreateIndex
CREATE INDEX "Solicitud_solicitanteId_idx" ON "Solicitud"("solicitanteId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudItem_entregaAnteriorItemId_key" ON "SolicitudItem"("entregaAnteriorItemId");

-- CreateIndex
CREATE INDEX "SolicitudItem_solicitudId_idx" ON "SolicitudItem"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "Entrega_solicitudId_key" ON "Entrega"("solicitudId");

-- CreateIndex
CREATE INDEX "Entrega_receptorId_idx" ON "Entrega"("receptorId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaItem_solicitudItemId_key" ON "EntregaItem"("solicitudItemId");

-- CreateIndex
CREATE INDEX "EntregaItem_entregaId_idx" ON "EntregaItem"("entregaId");

-- CreateIndex
CREATE INDEX "EntregaItem_venceEn_idx" ON "EntregaItem"("venceEn");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_creadoEn_idx" ON "Auditoria"("creadoEn");
