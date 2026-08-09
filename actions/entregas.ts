"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirUsuario } from "@/lib/auth";
import { bufferDesdeDataUrl, guardarImagen } from "@/lib/archivos";
import { calcularVenceEn } from "@/lib/vencimientos";
import { formatearFolio } from "@/lib/folio";
import {
  esGestion,
  puedeActuarSobre,
  puedeTransicionar,
} from "@/lib/solicitud-estado";
import type { Rol } from "@/generated/prisma/enums";
import type { Alcance } from "@/lib/alcance";
import { dejarAviso } from "@/lib/avisos";
import { alcanza } from "@/lib/alcance";
import { notificar } from "@/lib/notificaciones";

export type EstadoEntrega = { error?: string };

/** Quién firma el acta, cuando no es el destinatario. */
type Receptor = {
  recibidoPorId: string | null;
  recibidoPorNombre: string | null;
  recibidoPorRut: string | null;
};

const SIN_RECEPTOR_ALTERNO: Receptor = {
  recibidoPorId: null,
  recibidoPorNombre: null,
  recibidoPorRut: null,
};

/**
 * Lee quién está recibiendo en la práctica.
 *
 * El material va dirigido a alguien, pero a veces lo retira otro: un compañero
 * que baja del cerro, el supervisor que pasa por bodega. Quien retira es quien
 * firma, así que el acta tiene que nombrarlo o la firma no correspondería a
 * nadie. El destinatario **no cambia**: el equipamiento sigue siendo suyo y en
 * su historial queda.
 *
 * Tres formas, en orden de trazabilidad: el propio destinatario (lo normal),
 * otro usuario del sistema, o un nombre a mano para quien no tiene cuenta.
 */
async function leerReceptor(
  formData: FormData,
  usuario: { id: string; rol: Rol; alcance: Alcance },
  solicitud: { solicitanteId: string },
): Promise<
  { receptor: Receptor; error?: undefined } | { receptor?: undefined; error: string }
> {
  const modo = String(formData.get("receptorModo") ?? "destinatario");

  if (modo === "destinatario") return { receptor: SIN_RECEPTOR_ALTERNO };

  // Solo gestión designa a un tercero: si el beneficiario está firmando su
  // propio retiro, por definición es él quien recibe.
  if (!esGestion(usuario.rol)) {
    return { error: "Solo gestión puede registrar que recibe otra persona." };
  }

  if (modo === "usuario") {
    const id = String(formData.get("recibidoPorId") ?? "");
    if (!id) return { error: "Elige quién recibe el material." };

    // Recibir «en nombre de sí mismo» no es un caso: es la entrega normal.
    if (id === solicitud.solicitanteId) return { receptor: SIN_RECEPTOR_ALTERNO };

    const persona = await db.usuario.findUnique({ where: { id } });
    if (!persona || !persona.activo) {
      return { error: "Esa persona ya no existe o está desactivada." };
    }
    if (!alcanza(usuario.alcance, persona.empresaId)) {
      return { error: "Esa persona no pertenece a una empresa que gestiones." };
    }

    return {
      receptor: {
        recibidoPorId: persona.id,
        recibidoPorNombre: null,
        recibidoPorRut: null,
      },
    };
  }

  if (modo === "manual") {
    const nombre = String(formData.get("recibidoPorNombre") ?? "").trim();
    const rut = String(formData.get("recibidoPorRut") ?? "").trim() || null;

    if (nombre.length < 3) {
      return { error: "Indica el nombre completo de quien recibe." };
    }

    return {
      receptor: { recibidoPorId: null, recibidoPorNombre: nombre, recibidoPorRut: rut },
    };
  }

  return { error: "Indica quién recibe el material." };
}

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

  const leido = await leerReceptor(formData, usuario, solicitud);
  if (leido.receptor === undefined) return { error: leido.error };
  const receptor = leido.receptor;

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
        // El destinatario no cambia aunque retire otro: el equipamiento pasa a
        // ser suyo y en su historial vive.
        receptorId: solicitud.solicitanteId,
        entregadoPorId,
        entregadaEn: ahora,
        firmaPngUrl,
        observaciones,
        ...receptor,
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
      // Que firmó un tercero es justo lo que habría que poder reconstruir si
      // alguien discute el acta después.
      ...(receptor.recibidoPorId || receptor.recibidoPorNombre
        ? {
            recibidoPor:
              receptor.recibidoPorId ?? receptor.recibidoPorNombre,
          }
        : {}),
    },
  });

  // El destinatario tiene que enterarse de que su equipamiento se entregó,
  // sobre todo si lo retiró otro: es el único aviso que le dice que ya está a
  // su nombre sin haberlo tenido nunca en la mano.
  const nombreQuienRecibio = receptor.recibidoPorId
    ? ((await db.usuario.findUnique({
        where: { id: receptor.recibidoPorId },
        select: { nombre: true },
      }))?.nombre ?? null)
    : receptor.recibidoPorNombre;

  await notificar({
    destinatarios: [solicitud.solicitanteId],
    tipo: "SOLICITUD_ENTREGADA",
    titulo: `Solicitud ${formatearFolio(solicitud.folio)} entregada`,
    cuerpo: nombreQuienRecibio
      ? `Retirada por ${nombreQuienRecibio} a tu nombre. El acta ya está disponible.`
      : "Entregada y firmada. El acta ya está disponible.",
    url: `/solicitudes/${solicitud.id}`,
    excluir: usuario.id,
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
