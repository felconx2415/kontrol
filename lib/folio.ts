import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Entrega el siguiente folio correlativo. Debe llamarse dentro de una
 * transacción para que dos solicitudes simultáneas no reciban el mismo número.
 */
export async function siguienteFolio(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const contador = await tx.contador.upsert({
    where: { nombre: "solicitud" },
    create: { nombre: "solicitud", valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return contador.valor;
}

export function formatearFolio(folio: number): string {
  return `S-${String(folio).padStart(5, "0")}`;
}
