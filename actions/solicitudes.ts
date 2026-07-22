"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirUsuario } from "@/lib/auth";
import { siguienteFolio } from "@/lib/folio";
import { esGestion, puedeTransicionar } from "@/lib/solicitud-estado";
import { dejarAviso } from "@/lib/avisos";
import type { EstadoSolicitud, MotivoReemplazo, TipoSolicitud } from "@/generated/prisma/enums";

export type EstadoFormulario = { error?: string; ok?: boolean };

type ItemEntrante = {
  articuloId: string;
  cantidad: number;
  talla?: string | null;
  motivoReemplazo?: MotivoReemplazo | null;
  detalleReemplazo?: string | null;
  fotoEvidenciaUrl?: string | null;
  entregaAnteriorItemId?: string | null;
};

export async function crearSolicitud(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();

  const tipo = String(formData.get("tipo") ?? "") as TipoSolicitud;
  if (tipo !== "NUEVO" && tipo !== "REEMPLAZO") {
    return { error: "Selecciona el tipo de solicitud." };
  }

  const justificacion = String(formData.get("justificacion") ?? "").trim() || null;

  let items: ItemEntrante[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "No se pudieron leer los ítems de la solicitud." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Agrega al menos un ítem a la solicitud." };
  }

  // Validar contra el catálogo: nunca confiar en los ids que llegan del cliente.
  const articulos = await db.articulo.findMany({
    where: { id: { in: items.map((i) => i.articuloId) }, activo: true },
  });
  const porId = new Map(articulos.map((a) => [a.id, a]));

  for (const item of items) {
    const articulo = porId.get(item.articuloId);
    if (!articulo) return { error: "Uno de los artículos ya no está disponible." };
    if (!Number.isInteger(item.cantidad) || item.cantidad < 1) {
      return { error: `Cantidad inválida para ${articulo.nombre}.` };
    }
    if (articulo.requiereTalla && !item.talla) {
      return { error: `Indica la talla para ${articulo.nombre}.` };
    }
    if (tipo === "REEMPLAZO" && !item.motivoReemplazo) {
      return { error: `Indica el motivo de reemplazo para ${articulo.nombre}.` };
    }
  }

  // Un EntregaItem solo puede ser reemplazado una vez.
  const referencias = items
    .map((i) => i.entregaAnteriorItemId)
    .filter((v): v is string => Boolean(v));
  if (referencias.length > 0) {
    const yaReemplazados = await db.solicitudItem.count({
      where: { entregaAnteriorItemId: { in: referencias } },
    });
    if (yaReemplazados > 0) {
      return {
        error: "Uno de los ítems seleccionados ya tiene un reemplazo en curso.",
      };
    }
  }

  const solicitud = await db.$transaction(async (tx) => {
    const folio = await siguienteFolio(tx);
    return tx.solicitud.create({
      data: {
        folio,
        solicitanteId: usuario.id,
        brigadaId: usuario.brigadaId,
        tipo,
        estado: "PENDIENTE",
        enviadaEn: new Date(),
        justificacion,
        items: {
          create: items.map((i) => ({
            articuloId: i.articuloId,
            cantidad: i.cantidad,
            talla: i.talla || null,
            motivoReemplazo: tipo === "REEMPLAZO" ? i.motivoReemplazo : null,
            detalleReemplazo: i.detalleReemplazo || null,
            fotoEvidenciaUrl: i.fotoEvidenciaUrl || null,
            entregaAnteriorItemId: i.entregaAnteriorItemId || null,
          })),
        },
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Solicitud",
    entidadId: solicitud.id,
    accion: "CREADA",
    detalle: { tipo, items: items.length },
  });

  await dejarAviso("Solicitud enviada. Queda a la espera de aprobación.");
  redirect(`/solicitudes/${solicitud.id}`);
}

export type CambioItem = {
  itemId: string;
  cantidad: number;
  talla: string | null;
  quitar: boolean;
};

/**
 * Ajuste del pedido por parte de quien aprueba.
 *
 * Solo mientras está PENDIENTE: una vez aprobada, el pedido al almacén se hace
 * sobre esas cantidades y cambiarlas después descuadraría lo que llega.
 * No permite agregar artículos: el pedido sigue siendo del solicitante.
 */
export async function editarSolicitud(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();

  if (usuario.rol !== "APROBADOR" && !esGestion(usuario.rol)) {
    return { error: "No tienes permiso para editar solicitudes." };
  }

  const solicitudId = String(formData.get("solicitudId") ?? "");

  let cambios: CambioItem[];
  try {
    cambios = JSON.parse(String(formData.get("cambios") ?? "[]"));
  } catch {
    return { error: "No se pudieron leer los cambios." };
  }

  const solicitud = await db.solicitud.findUnique({
    where: { id: solicitudId },
    include: { items: { include: { articulo: true } } },
  });

  if (!solicitud) return { error: "La solicitud no existe." };
  if (solicitud.estado !== "PENDIENTE") {
    return { error: "Solo se puede editar una solicitud pendiente de aprobación." };
  }

  const porId = new Map(solicitud.items.map((i) => [i.id, i]));
  const conservados = cambios.filter((c) => !c.quitar);

  if (conservados.length === 0) {
    return {
      error: "Debe quedar al menos un ítem. Si no corresponde nada, rechaza la solicitud.",
    };
  }

  for (const c of cambios) {
    const item = porId.get(c.itemId);
    if (!item) return { error: "Uno de los ítems ya no pertenece a esta solicitud." };
    if (c.quitar) continue;
    if (!Number.isInteger(c.cantidad) || c.cantidad < 1) {
      return { error: `Cantidad inválida para ${item.articulo.nombre}.` };
    }
    if (item.articulo.requiereTalla && !c.talla?.trim()) {
      return { error: `Indica la talla para ${item.articulo.nombre}.` };
    }
  }

  // Diferencia legible, para dejar constancia de qué cambió exactamente.
  const detalle: string[] = [];
  for (const c of cambios) {
    const item = porId.get(c.itemId)!;
    if (c.quitar) {
      detalle.push(`Quitado: ${item.articulo.nombre} (x${item.cantidad})`);
      continue;
    }
    if (c.cantidad !== item.cantidad) {
      detalle.push(`${item.articulo.nombre}: cantidad ${item.cantidad} → ${c.cantidad}`);
    }
    const tallaNueva = c.talla?.trim() || null;
    if (tallaNueva !== item.talla) {
      detalle.push(
        `${item.articulo.nombre}: talla ${item.talla ?? "—"} → ${tallaNueva ?? "—"}`,
      );
    }
  }

  if (detalle.length === 0) return { error: "No hiciste ningún cambio." };

  await db.$transaction(async (tx) => {
    for (const c of cambios) {
      if (c.quitar) {
        // Al borrar el ítem se libera el EntregaItem que venía a reemplazar,
        // de modo que puede volver a pedirse más adelante.
        await tx.solicitudItem.delete({ where: { id: c.itemId } });
        continue;
      }
      await tx.solicitudItem.update({
        where: { id: c.itemId },
        data: { cantidad: c.cantidad, talla: c.talla?.trim() || null },
      });
    }

    await tx.solicitud.update({
      where: { id: solicitudId },
      data: { editadaEn: new Date(), editadaPorId: usuario.id },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Solicitud",
    entidadId: solicitudId,
    accion: "EDITADA",
    detalle,
  });

  await dejarAviso("Pedido actualizado.");
  revalidatePath(`/solicitudes/${solicitudId}`);
  revalidatePath("/solicitudes");
  return { ok: true };
}

/** Aplica una transición de estado validando rol y estado de origen. */
export async function cambiarEstado(
  solicitudId: string,
  nuevoEstado: EstadoSolicitud,
  extra?: { motivoRechazo?: string; pedidoExternoRef?: string },
): Promise<{ error?: string }> {
  const usuario = await requerirUsuario();

  // ENTREGADA exige firma y registro de entrega: solo la puede fijar
  // registrarEntrega() en actions/entregas.ts, nunca esta vía genérica.
  if (nuevoEstado === "ENTREGADA") {
    return { error: "La entrega debe registrarse con la firma del receptor." };
  }

  const solicitud = await db.solicitud.findUnique({ where: { id: solicitudId } });
  if (!solicitud) return { error: "La solicitud no existe." };

  if (!puedeTransicionar(solicitud.estado, nuevoEstado, usuario.rol)) {
    return { error: "No puedes realizar esa acción sobre esta solicitud." };
  }

  // El solicitante solo puede cancelar lo suyo.
  if (
    usuario.rol === "SOLICITANTE" &&
    solicitud.solicitanteId !== usuario.id
  ) {
    return { error: "Solo puedes modificar tus propias solicitudes." };
  }

  if (nuevoEstado === "RECHAZADA" && !extra?.motivoRechazo?.trim()) {
    return { error: "Indica el motivo del rechazo." };
  }

  const ahora = new Date();
  const datos: Record<string, unknown> = { estado: nuevoEstado };

  switch (nuevoEstado) {
    case "APROBADA":
      datos.aprobadorId = usuario.id;
      datos.aprobadaEn = ahora;
      break;
    case "RECHAZADA":
      datos.aprobadorId = usuario.id;
      datos.aprobadaEn = ahora;
      datos.motivoRechazo = extra?.motivoRechazo?.trim();
      break;
    case "EN_GESTION":
      datos.gestorId = usuario.id;
      datos.enGestionEn = ahora;
      datos.pedidoExternoRef = extra?.pedidoExternoRef?.trim() || null;
      break;
    case "RECIBIDA":
      datos.gestorId = usuario.id;
      datos.recibidaEn = ahora;
      break;
    case "CANCELADA":
      datos.canceladaEn = ahora;
      break;
  }

  await db.solicitud.update({ where: { id: solicitudId }, data: datos });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Solicitud",
    entidadId: solicitudId,
    accion: nuevoEstado,
    detalle: extra,
  });

  const CONFIRMACION: Partial<Record<EstadoSolicitud, string>> = {
    APROBADA: "Solicitud aprobada.",
    RECHAZADA: "Solicitud rechazada.",
    EN_GESTION: "Pedido registrado con el almacén.",
    RECIBIDA: "Marcada como recibida en bodega.",
    CANCELADA: "Solicitud cancelada.",
  };
  const confirmacion = CONFIRMACION[nuevoEstado];
  if (confirmacion) await dejarAviso(confirmacion);

  revalidatePath(`/solicitudes/${solicitudId}`);
  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");
  return {};
}

/** Wrapper para usar cambiarEstado directamente desde un <form action>. */
export async function accionCambiarEstado(formData: FormData) {
  const solicitudId = String(formData.get("solicitudId") ?? "");
  const nuevoEstado = String(formData.get("nuevoEstado") ?? "") as EstadoSolicitud;
  const motivoRechazo = String(formData.get("motivoRechazo") ?? "");
  const pedidoExternoRef = String(formData.get("pedidoExternoRef") ?? "");

  const resultado = await cambiarEstado(solicitudId, nuevoEstado, {
    motivoRechazo,
    pedidoExternoRef,
  });

  if (resultado.error) {
    redirect(`/solicitudes/${solicitudId}?error=${encodeURIComponent(resultado.error)}`);
  }

  redirect(`/solicitudes/${solicitudId}`);
}
