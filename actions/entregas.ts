"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirRol } from "@/lib/auth";
import { bufferDesdeDataUrl, guardarImagen } from "@/lib/archivos";
import { calcularVenceEn } from "@/lib/vencimientos";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { dejarAviso } from "@/lib/avisos";

export type EstadoEntrega = { error?: string };

export async function registrarEntrega(
  _estado: EstadoEntrega,
  formData: FormData,
): Promise<EstadoEntrega> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const solicitudId = String(formData.get("solicitudId") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const firmaDataUrl = String(formData.get("firma") ?? "");

  const firma = bufferDesdeDataUrl(firmaDataUrl);
  if (!firma) {
    return { error: "Falta la firma del receptor." };
  }

  const solicitud = await db.solicitud.findUnique({
    where: { id: solicitudId },
    include: { items: { include: { articulo: true } } },
  });

  if (!solicitud) return { error: "La solicitud no existe." };

  // Solo se entrega lo que ya llegó desde el almacén externo.
  if (solicitud.estado !== "RECIBIDA") {
    return {
      error: "La solicitud debe estar marcada como recibida antes de entregar.",
    };
  }

  // Cantidades realmente entregadas. El tope es lo recibido del almacén (que
  // puede ser menor a lo pedido); si no se registró recepción, se cae a lo pedido.
  const cantidades = new Map<string, number>();
  for (const item of solicitud.items) {
    const tope = item.cantidadRecibida ?? item.cantidad;
    const bruto = formData.get(`cantidad_${item.id}`);
    const cantidad = Number(bruto ?? tope);
    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > tope) {
      return {
        error: `Cantidad inválida para ${item.articulo.nombre} (máximo ${tope}).`,
      };
    }
    cantidades.set(item.id, cantidad);
  }

  if ([...cantidades.values()].every((c) => c === 0)) {
    return { error: "Debes entregar al menos un ítem." };
  }

  const firmaPngUrl = await guardarImagen(firma, "image/png", "firmas");
  const ahora = new Date();

  await db.$transaction(async (tx) => {
    const entrega = await tx.entrega.create({
      data: {
        solicitudId: solicitud.id,
        receptorId: solicitud.solicitanteId,
        entregadoPorId: usuario.id,
        entregadaEn: ahora,
        firmaPngUrl,
        observaciones,
      },
    });

    for (const item of solicitud.items) {
      const cantidad = cantidades.get(item.id) ?? 0;
      if (cantidad === 0) continue;

      await tx.entregaItem.create({
        data: {
          entregaId: entrega.id,
          solicitudItemId: item.id,
          cantidadEntregada: cantidad,
          venceEn: calcularVenceEn(ahora, item.articulo.vidaUtilDias),
        },
      });

      // Cierra la cadena: el ítem anterior queda fuera de uso.
      if (item.entregaAnteriorItemId) {
        await tx.entregaItem.update({
          where: { id: item.entregaAnteriorItemId },
          data: { reemplazadoEn: ahora },
        });
      }
    }

    await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: "ENTREGADA" },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Solicitud",
    entidadId: solicitud.id,
    accion: "ENTREGADA",
    detalle: { items: [...cantidades.entries()] },
  });

  await dejarAviso("Entrega registrada. El acta ya está disponible.");

  revalidatePath(`/solicitudes/${solicitud.id}`);
  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");

  redirect(`/solicitudes/${solicitud.id}`);
}
