"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirUsuario } from "@/lib/auth";
import { bufferDesdeDataUrl, guardarImagen } from "@/lib/archivos";
import { calcularVenceEn } from "@/lib/vencimientos";
import {
  esGestion,
  puedeActuarSobre,
  puedeTransicionar,
} from "@/lib/solicitud-estado";
import { dejarAviso } from "@/lib/avisos";

export type EstadoEntrega = { error?: string };

export async function registrarEntrega(
  _estado: EstadoEntrega,
  formData: FormData,
): Promise<EstadoEntrega> {
  const usuario = await requerirUsuario();

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

  if (!puedeTransicionar(solicitud.estado, "ENTREGADA", usuario.rol)) {
    return { error: "No puedes registrar la entrega de esta solicitud." };
  }

  if (!puedeActuarSobre(usuario, solicitud)) {
    return { error: "Solo puedes firmar la recepción de tus propias solicitudes." };
  }

  // Solo se entrega lo que ya llegó desde el almacén externo.
  if (solicitud.estado !== "RECIBIDA") {
    return {
      error: "La solicitud debe estar marcada como recibida antes de entregar.",
    };
  }

  // Cantidades realmente entregadas. El tope es lo recibido del almacén (que
  // puede ser menor a lo pedido); si no se registró recepción, se cae a lo pedido.
  const cantidades = new Map<string, number>();
  const series = new Map<string, string | null>();
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
    series.set(item.id, String(formData.get(`serie_${item.id}`) ?? "").trim() || null);
  }

  if ([...cantidades.values()].every((c) => c === 0)) {
    return { error: "Debes entregar al menos un ítem." };
  }

  const firmaPngUrl = await guardarImagen(firma, "image/png", "firmas");
  const ahora = new Date();

  // Cuando el beneficiario retira y firma él mismo, el acta no puede llevarlo a
  // él en los dos lados: entrega quien gestionó el pedido con el almacén, que es
  // de donde salió el material. Solo si no consta —solicitudes anteriores a que
  // se registrara el gestor— se cae al propio firmante.
  const retiroPropio = !esGestion(usuario.rol);
  const entregadoPorId = retiroPropio
    ? (solicitud.gestorId ?? usuario.id)
    : usuario.id;

  await db.$transaction(async (tx) => {
    const entrega = await tx.entrega.create({
      data: {
        solicitudId: solicitud.id,
        receptorId: solicitud.solicitanteId,
        entregadoPorId,
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
          numeroSerie: series.get(item.id) ?? null,
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
    detalle: {
      items: [...cantidades.entries()],
      ...(retiroPropio ? { retiradoPorElBeneficiario: true } : {}),
    },
  });

  await dejarAviso(
    retiroPropio
      ? "Recepción firmada. El acta ya está disponible."
      : "Entrega registrada. El acta ya está disponible.",
  );

  revalidatePath(`/solicitudes/${solicitud.id}`);
  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");

  redirect(`/solicitudes/${solicitud.id}`);
}
