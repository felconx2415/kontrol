-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN "reservaSolicitadaEn" DATETIME;

-- AlterTable
ALTER TABLE "SolicitudItem" ADD COLUMN "numeroReserva" TEXT;
ALTER TABLE "SolicitudItem" ADD COLUMN "posicionReserva" TEXT;
