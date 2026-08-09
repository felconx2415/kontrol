"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirUsuario } from "@/lib/auth";
import { formatearFolio, siguienteFolio } from "@/lib/folio";
import {
  CECO_ALMACEN,
  esGestion,
  faltaReserva,
  lineasConReserva,
  lineasDeAlmacen,
  MAXIMO_BENEFICIARIOS,
  motivosDe,
  puedeActuarSobre,
  puedeTransicionar,
} from "@/lib/solicitud-estado";
import { dejarAviso } from "@/lib/avisos";
import { alcanza, filtroEmpresa } from "@/lib/alcance";
import {
  destinatariosPorRol,
  notificar,
  ROLES_A_AVISAR,
} from "@/lib/notificaciones";
import type {
  EstadoSolicitud,
  Motivo,
  TipoNotificacion,
  TipoSolicitud,
} from "@/generated/prisma/enums";

export type EstadoFormulario = { error?: string; ok?: boolean };

type ItemEntrante = {
  articuloId: string;
  cantidad: number;
  motivo?: Motivo | null;
  detalleReemplazo?: string | null;
  fotoEvidenciaUrl?: string | null;
  entregaAnteriorItemId?: string | null;
};

/** Un destinatario del envío: a quién se le pide y qué se le pide. */
type DestinatarioEntrante = {
  usuarioId: string;
  tipo: TipoSolicitud;
  items: ItemEntrante[];
};

/**
 * Crea las solicitudes. Normalmente el beneficiario es quien la escribe, pero
 * gestión puede pedir a nombre de otros: en terreno la brigada avisa por radio
 * o WhatsApp y quien tiene la cuenta abierta es el gestor. Cada solicitud queda
 * a nombre de su beneficiario —él la ve en su cuenta, él firma al recibir— y
 * `creadaPorId` guarda quién la tecleó.
 *
 * El envío puede traer varios destinatarios, y **cada uno con su propia carga**:
 * no todos necesitan lo mismo, así que cada persona lleva su tipo de solicitud
 * y sus ítems. Se crea una solicitud por persona, nunca una compartida: cada
 * una tiene su folio, se aprueba por separado y termina en un acta firmada por
 * su dueño.
 *
 * No se salta ningún paso: nacen PENDIENTE y siguen el mismo camino de siempre
 * hasta el pedido al almacén.
 */
export async function crearSolicitud(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();

  let destinatarios: DestinatarioEntrante[];
  try {
    const crudo = JSON.parse(String(formData.get("destinatarios") ?? "[]"));
    destinatarios = Array.isArray(crudo) ? crudo : [];
  } catch {
    return { error: "No se pudo leer el contenido de la solicitud." };
  }

  if (destinatarios.length === 0) {
    return { error: "Agrega al menos una persona con su equipamiento." };
  }
  if (destinatarios.length > MAXIMO_BENEFICIARIOS) {
    return {
      error: `No se puede pedir para más de ${MAXIMO_BENEFICIARIOS} personas a la vez.`,
    };
  }

  const ids = destinatarios.map((d) => String(d.usuarioId ?? ""));
  if (ids.some((id) => id === "")) {
    return { error: "Falta indicar a quién corresponde una de las cargas." };
  }
  if (new Set(ids).size !== ids.length) {
    return {
      error:
        "Una persona aparece dos veces. Junta su equipamiento en una sola carga.",
    };
  }

  const aNombreDeOtros = ids.some((id) => id !== usuario.id);
  if (aNombreDeOtros && !esGestion(usuario.rol)) {
    return { error: "Solo gestión puede solicitar a nombre de otros usuarios." };
  }

  const personas = await db.usuario.findMany({
    where: { id: { in: ids }, activo: true },
    select: { id: true, nombre: true, brigadaId: true, empresaId: true },
  });
  const personaPorId = new Map(personas.map((p) => [p.id, p]));

  if (personas.length !== ids.length) {
    return {
      error:
        "Alguno de los usuarios para los que solicitas ya no existe o está desactivado.",
    };
  }

  // Pedir a nombre de alguien de otra empresa crearía un pedido que ni quien lo
  // registró volvería a ver. El propio beneficiario nunca cae aquí: su empresa
  // es, por definición, una de las suyas.
  const fuera = personas.find(
    (p) => p.id !== usuario.id && !alcanza(usuario.alcance, p.empresaId),
  );
  if (fuera) {
    return {
      error: `${fuera.nombre} no pertenece a ninguna de las empresas que gestionas.`,
    };
  }

  const justificacion = String(formData.get("justificacion") ?? "").trim() || null;

  // ── Validación, carga por carga ─────────────────────────────────────────
  // Los errores nombran a la persona: con varias cargas en pantalla, «indica un
  // motivo» a secas no diría dónde mirar.
  const articulosPedidos = destinatarios.flatMap((d) =>
    (d.items ?? []).map((i) => i.articuloId),
  );
  const articulos = await db.articulo.findMany({
    where: { id: { in: articulosPedidos }, activo: true },
  });
  const articuloPorId = new Map(articulos.map((a) => [a.id, a]));

  // Los ítems entregados que se vienen a reemplazar, en una sola consulta.
  const referencias = destinatarios.flatMap((d) =>
    (d.items ?? [])
      .map((i) => i.entregaAnteriorItemId)
      .filter((v): v is string => Boolean(v)),
  );
  if (new Set(referencias).size !== referencias.length) {
    return { error: "Hay un mismo ítem repetido para reemplazar." };
  }

  const previos = await db.entregaItem.findMany({
    where: { id: { in: referencias } },
    select: {
      id: true,
      reemplazadoEn: true,
      entrega: { select: { receptorId: true } },
      reemplazadoPor: { select: { id: true } },
    },
  });
  const previoPorId = new Map(previos.map((p) => [p.id, p]));

  for (const destinatario of destinatarios) {
    const persona = personaPorId.get(destinatario.usuarioId)!;
    const items = destinatario.items ?? [];
    const tipo = destinatario.tipo;

    if (tipo !== "NUEVO" && tipo !== "REEMPLAZO") {
      return { error: `${persona.nombre}: selecciona el tipo de solicitud.` };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { error: `${persona.nombre}: agrega al menos un ítem.` };
    }

    const motivosValidos = motivosDe(tipo);
    for (const item of items) {
      const articulo = articuloPorId.get(item.articuloId);
      if (!articulo) {
        return { error: `${persona.nombre}: uno de los artículos ya no está disponible.` };
      }
      if (!Number.isInteger(item.cantidad) || item.cantidad < 1) {
        return { error: `${persona.nombre}: cantidad inválida para ${articulo.nombre}.` };
      }
      if (!item.motivo || !motivosValidos.includes(item.motivo)) {
        return { error: `${persona.nombre}: indica un motivo válido para ${articulo.nombre}.` };
      }

      // Un EntregaItem solo puede reemplazarse una vez, y solo por su dueño: el
      // id llega del cliente, así que hay que comprobar de quién es.
      if (!item.entregaAnteriorItemId) continue;

      if (tipo !== "REEMPLAZO") {
        return { error: `${persona.nombre}: solo un reemplazo puede apuntar a un ítem entregado.` };
      }
      const previo = previoPorId.get(item.entregaAnteriorItemId);
      if (!previo) {
        return { error: `${persona.nombre}: uno de los ítems a reemplazar ya no existe.` };
      }
      if (previo.entrega.receptorId !== persona.id) {
        return {
          error: `Uno de los ítems a reemplazar no está asignado a ${persona.nombre}.`,
        };
      }
      if (previo.reemplazadoPor || previo.reemplazadoEn) {
        return {
          error: `${persona.nombre}: uno de los ítems seleccionados ya tiene un reemplazo en curso.`,
        };
      }
    }
  }

  const enviadaEn = new Date();

  // Todas las solicitudes se crean juntas o no se crea ninguna: si el pedido
  // para la quinta persona falla, dejar las cuatro primeras vivas obligaría a
  // adivinar cuáles hay que repetir.
  const creadas = await db.$transaction(async (tx) => {
    const resultado: {
      id: string;
      folio: number;
      nombre: string;
      solicitanteId: string;
      empresaId: string | null;
      esPropia: boolean;
      items: number;
      tipo: TipoSolicitud;
    }[] = [];

    for (const destinatario of destinatarios) {
      const persona = personaPorId.get(destinatario.usuarioId)!;
      const tipo = destinatario.tipo;
      const items = destinatario.items;

      const folio = await siguienteFolio(tx);
      const solicitud = await tx.solicitud.create({
        data: {
          folio,
          solicitanteId: persona.id,
          // La brigada es la del beneficiario, no la de quien registra: es la
          // que va en el formato del almacén. La empresa, por lo mismo: el
          // pedido pertenece a la del beneficiario aunque lo teclee un gestor
          // que lleva varias.
          brigadaId: persona.brigadaId,
          empresaId: persona.empresaId,
          creadaPorId: persona.id === usuario.id ? null : usuario.id,
          tipo,
          estado: "PENDIENTE",
          enviadaEn,
          justificacion,
          items: {
            create: items.map((i) => ({
              articuloId: i.articuloId,
              cantidad: i.cantidad,
              motivo: i.motivo,
              // Detalle, foto y cadena de reemplazo solo aplican a reemplazos.
              detalleReemplazo: tipo === "REEMPLAZO" ? i.detalleReemplazo || null : null,
              fotoEvidenciaUrl: tipo === "REEMPLAZO" ? i.fotoEvidenciaUrl || null : null,
              entregaAnteriorItemId:
                tipo === "REEMPLAZO" ? i.entregaAnteriorItemId || null : null,
            })),
          },
        },
      });

      resultado.push({
        id: solicitud.id,
        folio,
        nombre: persona.nombre,
        solicitanteId: persona.id,
        empresaId: persona.empresaId,
        esPropia: persona.id === usuario.id,
        items: items.length,
        tipo,
      });
    }

    return resultado;
  });

  for (const creada of creadas) {
    await registrarAuditoria({
      usuarioId: usuario.id,
      entidad: "Solicitud",
      entidadId: creada.id,
      accion: "CREADA",
      detalle: {
        tipo: creada.tipo,
        items: creada.items,
        ...(creada.esPropia ? {} : { aNombreDe: creada.nombre }),
        // Con un envío múltiple, deja rastro de con qué otras nació.
        ...(creadas.length > 1
          ? {
              juntoConFolios: creadas
                .filter((c) => c.id !== creada.id)
                .map((c) => formatearFolio(c.folio)),
            }
          : {}),
      },
    });
  }

  // Quien aprueba se entera de que hay cola; el beneficiario, de que pidieron
  // a su nombre. A quien la escribió no, que acaba de hacerlo.
  for (const creada of creadas) {
    const aprobadores = await destinatariosPorRol(
      ROLES_A_AVISAR.SOLICITUD_CREADA!,
      creada.empresaId,
    );

    await notificar({
      // El beneficiario entra en la lista solo si el pedido no es suyo: si lo
      // escribió él, la notificación le contaría lo que acaba de hacer.
      destinatarios: creada.esPropia
        ? aprobadores
        : [...aprobadores, creada.solicitanteId],
      tipo: "SOLICITUD_CREADA",
      titulo: `Solicitud ${formatearFolio(creada.folio)} por aprobar`,
      cuerpo: `${creada.nombre} · ${creada.tipo === "REEMPLAZO" ? "Reemplazo" : "Equipamiento nuevo"} · ${creada.items} ítem${creada.items === 1 ? "" : "s"}.`,
      url: `/solicitudes/${creada.id}`,
      excluir: usuario.id,
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");

  // Con una sola solicitud se va a su detalle, que es lo que se quiere ver.
  // Con varias no hay un detalle único al que ir: el listado las muestra todas.
  if (creadas.length === 1) {
    const [unica] = creadas;
    await dejarAviso(
      unica.esPropia
        ? "Solicitud enviada. Queda a la espera de aprobación."
        : `Solicitud creada a nombre de ${unica.nombre}. Queda a la espera de aprobación.`,
    );
    redirect(`/solicitudes/${unica.id}`);
  }

  await dejarAviso(
    `Se crearon ${creadas.length} solicitudes, una por persona (${creadas
      .map((c) => formatearFolio(c.folio))
      .join(", ")}). Todas quedan a la espera de aprobación.`,
  );
  redirect("/solicitudes?estado=PENDIENTE");
}

/**
 * Avisa del cambio de estado a quien corresponde.
 *
 * Cada estado tiene dos audiencias posibles y distinta razón para enterarse: el
 * beneficiario **espera** su equipamiento y quiere saber en qué va; gestión
 * **tiene que hacer** el paso siguiente. Por eso el texto no es el mismo para
 * los dos, aunque el hecho sí.
 *
 * Los estados que no aparecen aquí no generan aviso: BORRADOR no le importa a
 * nadie más, y ENTREGADA la avisa registrarEntrega(), que es la única que sabe
 * quién firmó.
 */
async function avisarCambioDeEstado(
  solicitud: {
    id: string;
    folio: number;
    solicitanteId: string;
    empresaId: string | null;
  },
  nuevoEstado: EstadoSolicitud,
  autorId: string,
  motivoRechazo?: string | null,
): Promise<void> {
  const folio = formatearFolio(solicitud.folio);
  const url = `/solicitudes/${solicitud.id}`;

  // Lo que se le cuenta a quien espera el equipamiento.
  const PARA_EL_BENEFICIARIO: Partial<
    Record<EstadoSolicitud, { tipo: TipoNotificacion; titulo: string; cuerpo: string }>
  > = {
    APROBADA: {
      tipo: "SOLICITUD_APROBADA",
      titulo: `Solicitud ${folio} aprobada`,
      cuerpo: "Aprobada. Ahora se pide el material al almacén.",
    },
    RECHAZADA: {
      tipo: "SOLICITUD_RECHAZADA",
      titulo: `Solicitud ${folio} rechazada`,
      cuerpo: motivoRechazo?.trim() || "No fue aprobada.",
    },
    RESERVA_SOLICITADA: {
      tipo: "SOLICITUD_RESERVA_SOLICITADA",
      titulo: `Solicitud ${folio}: reserva pedida`,
      cuerpo: "Se pidió el número de reserva al almacén.",
    },
    EN_GESTION: {
      tipo: "SOLICITUD_EN_GESTION",
      titulo: `Solicitud ${folio} pedida al almacén`,
      cuerpo: "El material viene en camino.",
    },
    RECIBIDA: {
      tipo: "SOLICITUD_RECIBIDA",
      titulo: `Solicitud ${folio}: material en bodega`,
      cuerpo: "Ya llegó. Te citarán para entregártelo y firmar.",
    },
    CANCELADA: {
      tipo: "SOLICITUD_CANCELADA",
      titulo: `Solicitud ${folio} cancelada`,
      cuerpo: "Se canceló antes de completarse.",
    },
  };

  const aviso = PARA_EL_BENEFICIARIO[nuevoEstado];
  if (aviso) {
    await notificar({
      destinatarios: [solicitud.solicitanteId],
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      url,
      excluir: autorId,
    });
  }

  // Y lo que le toca hacer a gestión.
  const PARA_GESTION: Partial<
    Record<EstadoSolicitud, { tipo: TipoNotificacion; titulo: string; cuerpo: string }>
  > = {
    APROBADA: {
      tipo: "SOLICITUD_APROBADA",
      titulo: `Solicitud ${folio} lista para pedir`,
      cuerpo: "Aprobada: queda pendiente el pedido al almacén.",
    },
    RECIBIDA: {
      tipo: "SOLICITUD_RECIBIDA",
      titulo: `Solicitud ${folio} lista para entregar`,
      cuerpo: "El material está en bodega: entrega y toma la firma.",
    },
  };

  const paraGestion = PARA_GESTION[nuevoEstado];
  if (!paraGestion) return;

  await notificar({
    destinatarios: await destinatariosPorRol(
      ROLES_A_AVISAR[paraGestion.tipo] ?? ["GESTOR", "ADMIN"],
      solicitud.empresaId,
    ),
    tipo: paraGestion.tipo,
    titulo: paraGestion.titulo,
    cuerpo: paraGestion.cuerpo,
    url,
    excluir: autorId,
  });
}

export type CambioItem = {
  itemId: string;
  cantidad: number;
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
  if (!alcanza(usuario.alcance, solicitud.empresaId)) {
    return { error: "Esa solicitud no pertenece a una empresa que gestiones." };
  }
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
        data: { cantidad: c.cantidad },
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

  // Al beneficiario le cambiaron lo que pidió: es de las pocas cosas que
  // conviene que sepa antes de recibir el material y no al abrirlo.
  await notificar({
    destinatarios: [solicitud.solicitanteId],
    tipo: "SOLICITUD_EDITADA",
    titulo: `Solicitud ${formatearFolio(solicitud.folio)} ajustada`,
    cuerpo: detalle.join(" · "),
    url: `/solicitudes/${solicitudId}`,
    excluir: usuario.id,
  });

  await dejarAviso("Pedido actualizado.");
  revalidatePath(`/solicitudes/${solicitudId}`);
  revalidatePath("/solicitudes");
  return { ok: true };
}

/** Reserva registrada para una línea del pedido. */
export type ItemReserva = {
  itemId: string;
  numeroReserva: string;
  posicionReserva: string;
};

/** Aplica una transición de estado validando rol y estado de origen. */
export async function cambiarEstado(
  solicitudId: string,
  nuevoEstado: EstadoSolicitud,
  extra?: {
    motivoRechazo?: string;
    reservas?: ItemReserva[];
  },
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

  if (!puedeActuarSobre(usuario, solicitud)) {
    return { error: "Solo puedes modificar tus propias solicitudes." };
  }

  if (nuevoEstado === "RECHAZADA" && !extra?.motivoRechazo?.trim()) {
    return { error: "Indica el motivo del rechazo." };
  }

  // Gestionar con el almacén exige que cada línea lleve su reserva: es el dato
  // con que el almacén identifica el pedido. Se valida sobre la mezcla de lo
  // ya guardado con lo que llega del formulario, para no perder lo registrado
  // en un paso anterior.
  let reservasAEscribir: ItemReserva[] = [];
  if (nuevoEstado === "EN_GESTION") {
    const items = await db.solicitudItem.findMany({
      where: { solicitudId },
      select: {
        id: true,
        numeroReserva: true,
        posicionReserva: true,
        articulo: { select: { ceco: true } },
      },
    });

    const entrantes = new Map(
      (extra?.reservas ?? []).map((r) => [r.itemId, r]),
    );

    const fusionadas = items.map((item) => {
      const entrante = entrantes.get(item.id);
      return {
        id: item.id,
        ceco: item.articulo.ceco,
        numeroReserva: entrante?.numeroReserva?.trim() || item.numeroReserva,
        posicionReserva:
          entrante?.posicionReserva?.trim() || item.posicionReserva,
      };
    });

    const problema = faltaReserva(fusionadas);
    if (problema) return { error: problema };

    reservasAEscribir = lineasConReserva(fusionadas).map((i) => ({
      itemId: i.id,
      numeroReserva: i.numeroReserva ?? "",
      posicionReserva: i.posicionReserva ?? "",
    }));
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
    case "RESERVA_SOLICITADA":
      datos.gestorId = usuario.id;
      datos.reservaSolicitadaEn = ahora;
      break;
    case "EN_GESTION":
      datos.gestorId = usuario.id;
      datos.enGestionEn = ahora;
      break;
    case "RECIBIDA":
      // Ver marcarRecibida(): recibir no reasigna el gestor del pedido.
      if (esGestion(usuario.rol)) datos.gestorId = usuario.id;
      datos.recibidaEn = ahora;
      break;
    case "CANCELADA":
      datos.canceladaEn = ahora;
      break;
  }

  // Las reservas y el cambio de estado son un solo hecho: una solicitud en
  // gestión sin reservas escritas, o al revés, dejaría el pedido a medias.
  await db.$transaction(async (tx) => {
    for (const reserva of reservasAEscribir) {
      await tx.solicitudItem.update({
        where: { id: reserva.itemId },
        data: {
          numeroReserva: reserva.numeroReserva,
          posicionReserva: reserva.posicionReserva || null,
        },
      });
    }
    await tx.solicitud.update({ where: { id: solicitudId }, data: datos });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Solicitud",
    entidadId: solicitudId,
    accion: nuevoEstado,
    detalle: extra,
  });

  await avisarCambioDeEstado(
    solicitud,
    nuevoEstado,
    usuario.id,
    extra?.motivoRechazo,
  );

  const CONFIRMACION: Partial<Record<EstadoSolicitud, string>> = {
    APROBADA: "Solicitud aprobada.",
    RECHAZADA: "Solicitud rechazada.",
    RESERVA_SOLICITADA: "Reserva solicitada al almacén.",
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

export type ItemRecepcion = {
  itemId: string;
  cantidadRecibida: number;
};

/**
 * Marca una solicitud como recibida registrando, por ítem, cuánto llegó
 * realmente del almacén. A veces no llega todo, así que cada ítem puede
 * recibirse por una cantidad menor a la pedida (nunca mayor, ni negativa).
 * Lo recibido pasa a ser el tope de lo que luego se puede entregar.
 */
export async function marcarRecibida(
  solicitudId: string,
  recepcion: ItemRecepcion[],
): Promise<{ error?: string }> {
  const usuario = await requerirUsuario();

  const solicitud = await db.solicitud.findUnique({
    where: { id: solicitudId },
    include: { items: { include: { articulo: true } } },
  });
  if (!solicitud) return { error: "La solicitud no existe." };

  if (!puedeTransicionar(solicitud.estado, "RECIBIDA", usuario.rol)) {
    return { error: "No puedes marcar como recibida esta solicitud." };
  }

  if (!puedeActuarSobre(usuario, solicitud)) {
    return { error: "Solo puedes recibir tus propias solicitudes." };
  }

  const porId = new Map(solicitud.items.map((i) => [i.id, i]));
  const recibidoPorItem = new Map<string, number>();

  for (const r of recepcion) {
    const item = porId.get(r.itemId);
    if (!item) return { error: "Uno de los ítems ya no pertenece a esta solicitud." };
    if (
      !Number.isInteger(r.cantidadRecibida) ||
      r.cantidadRecibida < 0 ||
      r.cantidadRecibida > item.cantidad
    ) {
      return {
        error: `Cantidad recibida inválida para ${item.articulo.nombre} (entre 0 y ${item.cantidad}).`,
      };
    }
    recibidoPorItem.set(r.itemId, r.cantidadRecibida);
  }

  // Todo ítem debe traer su cantidad recibida: lo que no viene se asume pedido.
  for (const item of solicitud.items) {
    if (!recibidoPorItem.has(item.id)) recibidoPorItem.set(item.id, item.cantidad);
  }

  if ([...recibidoPorItem.values()].every((c) => c === 0)) {
    return { error: "No se recibió ningún ítem. Si no llegó nada, cancela o deja pendiente el pedido." };
  }

  // Detalle legible: solo los ítems donde lo recibido no coincide con lo pedido.
  const detalle: string[] = [];
  for (const item of solicitud.items) {
    const recibido = recibidoPorItem.get(item.id)!;
    if (recibido !== item.cantidad) {
      detalle.push(`${item.articulo.nombre}: pedido ${item.cantidad}, recibido ${recibido}`);
    }
  }

  await db.$transaction(async (tx) => {
    for (const item of solicitud.items) {
      await tx.solicitudItem.update({
        where: { id: item.id },
        data: { cantidadRecibida: recibidoPorItem.get(item.id) },
      });
    }
    await tx.solicitud.update({
      where: { id: solicitudId },
      data: {
        estado: "RECIBIDA",
        // Si recibe el propio beneficiario no hay gestor nuevo que anotar:
        // sigue siendo quien gestionó el pedido con el almacén, y pisarlo
        // borraría el único rastro de quién lo hizo.
        ...(esGestion(usuario.rol) ? { gestorId: usuario.id } : {}),
        recibidaEn: new Date(),
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Solicitud",
    entidadId: solicitudId,
    accion: "RECIBIDA",
    detalle: detalle.length > 0 ? detalle : { completo: true },
  });

  await avisarCambioDeEstado(solicitud, "RECIBIDA", usuario.id);

  await dejarAviso(
    detalle.length > 0
      ? "Marcada como recibida (recepción parcial registrada)."
      : "Marcada como recibida en bodega.",
  );

  revalidatePath(`/solicitudes/${solicitudId}`);
  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");
  return {};
}

/** Wrapper de marcarRecibida para un <form action> con cantidades por ítem. */
export async function accionMarcarRecibida(formData: FormData) {
  const solicitudId = String(formData.get("solicitudId") ?? "");

  let recepcion: ItemRecepcion[];
  try {
    recepcion = JSON.parse(String(formData.get("recepcion") ?? "[]"));
  } catch {
    redirect(
      `/solicitudes/${solicitudId}?error=${encodeURIComponent("No se pudo leer la recepción.")}`,
    );
  }

  const resultado = await marcarRecibida(solicitudId, recepcion!);
  if (resultado.error) {
    redirect(`/solicitudes/${solicitudId}?error=${encodeURIComponent(resultado.error)}`);
  }
  redirect(`/solicitudes/${solicitudId}`);
}

/** Wrapper para usar cambiarEstado directamente desde un <form action>. */
export async function accionCambiarEstado(formData: FormData) {
  const solicitudId = String(formData.get("solicitudId") ?? "");
  const nuevoEstado = String(formData.get("nuevoEstado") ?? "") as EstadoSolicitud;
  const motivoRechazo = String(formData.get("motivoRechazo") ?? "");

  let reservas: ItemReserva[] = [];
  try {
    reservas = JSON.parse(String(formData.get("reservas") ?? "[]"));
  } catch {
    redirect(
      `/solicitudes/${solicitudId}?error=${encodeURIComponent("No se pudieron leer las reservas.")}`,
    );
  }

  const resultado = await cambiarEstado(solicitudId, nuevoEstado, {
    motivoRechazo,
    reservas,
  });

  if (resultado.error) {
    redirect(`/solicitudes/${solicitudId}?error=${encodeURIComponent(resultado.error)}`);
  }

  redirect(`/solicitudes/${solicitudId}`);
}

/**
 * Aprueba varias solicitudes de una vez.
 *
 * Cuando un gestor carga el equipamiento de una brigada entera quedan diez o
 * quince pedidos idénticos en la cola; aprobarlos uno por uno es puro trámite.
 * Se valida cada uno igual que en la vía individual —mismo rol, mismo estado de
 * origen— y las que no correspondan se dejan intactas y se informan, en vez de
 * fallar el lote completo o aprobarlas a la fuerza.
 */
export async function aprobarVarias(
  ids: string[],
): Promise<{ error?: string; mensaje?: string }> {
  const usuario = await requerirUsuario();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "No seleccionaste ninguna solicitud." };
  }

  // Los ids vienen de una lista con casillas marcadas: el alcance los acota
  // igual que si llegaran a mano.
  const solicitudes = await db.solicitud.findMany({
    where: { ...filtroEmpresa(usuario.alcance), id: { in: ids } },
    select: {
      id: true,
      folio: true,
      estado: true,
      solicitanteId: true,
      empresaId: true,
    },
  });

  const aprobables = solicitudes.filter((s) =>
    puedeTransicionar(s.estado, "APROBADA", usuario.rol),
  );

  if (aprobables.length === 0) {
    return {
      error:
        "Ninguna de las solicitudes seleccionadas se puede aprobar: revisa que sigan pendientes.",
    };
  }

  const ahora = new Date();
  await db.solicitud.updateMany({
    where: { id: { in: aprobables.map((s) => s.id) } },
    data: { estado: "APROBADA", aprobadorId: usuario.id, aprobadaEn: ahora },
  });

  for (const s of aprobables) {
    await registrarAuditoria({
      usuarioId: usuario.id,
      entidad: "Solicitud",
      entidadId: s.id,
      accion: "APROBADA",
      detalle: aprobables.length > 1 ? { enLoteDe: aprobables.length } : undefined,
    });
  }

  for (const s of aprobables) {
    await avisarCambioDeEstado(s, "APROBADA", usuario.id);
  }

  const omitidas = solicitudes.length - aprobables.length;
  const mensaje =
    aprobables.length === 1
      ? "Solicitud aprobada."
      : `Se aprobaron ${aprobables.length} solicitudes.`;

  await dejarAviso(
    omitidas > 0
      ? `${mensaje} ${omitidas} no estaba${omitidas === 1 ? "" : "n"} pendiente${
          omitidas === 1 ? "" : "s"
        } y quedó${omitidas === 1 ? "" : "aron"} sin cambios.`
      : mensaje,
  );

  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");
  return { mensaje };
}

/**
 * Pide el número de reserva de varias solicitudes de una vez.
 *
 * Es el paso propio del EPP: la reserva la entrega el almacén y hasta que
 * llegue no hay nada que registrar, así que el lote no necesita datos. Se valida
 * cada una igual que en la vía individual y las que no correspondan se dejan
 * intactas y se informan.
 */
export async function solicitarReservaVarias(
  ids: string[],
): Promise<{ error?: string; mensaje?: string }> {
  const usuario = await requerirUsuario();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "No seleccionaste ninguna solicitud." };
  }

  const solicitudes = await db.solicitud.findMany({
    where: { ...filtroEmpresa(usuario.alcance), id: { in: ids } },
    select: {
      id: true,
      folio: true,
      estado: true,
      solicitanteId: true,
      empresaId: true,
    },
  });

  const pedibles = solicitudes.filter((s) =>
    puedeTransicionar(s.estado, "RESERVA_SOLICITADA", usuario.rol),
  );

  if (pedibles.length === 0) {
    return {
      error:
        "Ninguna de las solicitudes seleccionadas puede pasar a reserva solicitada: deben estar aprobadas.",
    };
  }

  const ahora = new Date();
  await db.solicitud.updateMany({
    where: { id: { in: pedibles.map((s) => s.id) } },
    data: {
      estado: "RESERVA_SOLICITADA",
      gestorId: usuario.id,
      reservaSolicitadaEn: ahora,
    },
  });

  for (const s of pedibles) {
    await registrarAuditoria({
      usuarioId: usuario.id,
      entidad: "Solicitud",
      entidadId: s.id,
      accion: "RESERVA_SOLICITADA",
      detalle: pedibles.length > 1 ? { enLoteDe: pedibles.length } : undefined,
    });
  }

  for (const s of pedibles) {
    await avisarCambioDeEstado(s, "RESERVA_SOLICITADA", usuario.id);
  }

  const omitidas = solicitudes.length - pedibles.length;
  const mensaje =
    pedibles.length === 1
      ? "Reserva solicitada al almacén."
      : `Se pidió la reserva de ${pedibles.length} solicitudes.`;

  await dejarAviso(
    omitidas > 0
      ? `${mensaje} ${omitidas} no estaba${omitidas === 1 ? "" : "n"} aprobada${
          omitidas === 1 ? "" : "s"
        } y quedó${omitidas === 1 ? "" : "aron"} sin cambios.`
      : mensaje,
  );

  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");
  return { mensaje };
}

/**
 * Marca varias solicitudes como pedidas al almacén, bajo un mismo número de
 * reserva.
 *
 * Va de la mano del formato combinado: se descarga un único documento con
 * todas las seleccionadas y se envía una sola vez, así que registrarlas por
 * separado obligaría a repetir la misma reserva una y otra vez.
 *
 * Cubre solo la reserva del almacén, que es la que se pide con esa planilla y
 * viene sin posición. Una solicitud que además tenga líneas con reserva propia
 * no avanza por aquí: esas se registran una a una, con su posición.
 */
export async function enviarVariasAlAlmacen(
  ids: string[],
  numeroReserva?: string,
): Promise<{ error?: string; mensaje?: string }> {
  const usuario = await requerirUsuario();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "No seleccionaste ninguna solicitud." };
  }

  const reserva = numeroReserva?.trim();
  if (!reserva) {
    return { error: "Indica el número de reserva del almacén." };
  }

  const solicitudes = await db.solicitud.findMany({
    where: { ...filtroEmpresa(usuario.alcance), id: { in: ids } },
    orderBy: { folio: "asc" },
    select: {
      id: true,
      folio: true,
      estado: true,
      solicitanteId: true,
      empresaId: true,
      items: {
        select: {
          id: true,
          numeroReserva: true,
          posicionReserva: true,
          articulo: { select: { ceco: true } },
        },
      },
    },
  });

  const enviables = solicitudes.filter((s) => {
    if (!puedeTransicionar(s.estado, "EN_GESTION", usuario.rol)) return false;

    // Con la reserva del almacén ya puesta, ¿queda algo sin resolver? Si sí, es
    // una línea de reserva propia, que necesita su posición y no se puede
    // completar a ciegas desde el lote.
    const conReservaDelLote = s.items.map((i) => ({
      id: i.id,
      ceco: i.articulo.ceco,
      numeroReserva:
        i.articulo.ceco === CECO_ALMACEN ? reserva : i.numeroReserva,
      posicionReserva: i.posicionReserva,
    }));
    return faltaReserva(conReservaDelLote) === null;
  });

  if (enviables.length === 0) {
    return {
      error:
        "Ninguna de las solicitudes seleccionadas se puede pedir al almacén: deben estar aprobadas o con la reserva ya pedida, y sin líneas de reserva propia pendientes.",
    };
  }

  const lineas = enviables.flatMap((s) =>
    lineasDeAlmacen(s.items.map((i) => ({ id: i.id, ceco: i.articulo.ceco }))),
  );

  const ahora = new Date();

  await db.$transaction(async (tx) => {
    for (const linea of lineas) {
      await tx.solicitudItem.update({
        where: { id: linea.id },
        data: { numeroReserva: reserva },
      });
    }
    await tx.solicitud.updateMany({
      where: { id: { in: enviables.map((s) => s.id) } },
      data: {
        estado: "EN_GESTION",
        gestorId: usuario.id,
        enGestionEn: ahora,
      },
    });
  });

  for (const s of enviables) {
    await registrarAuditoria({
      usuarioId: usuario.id,
      entidad: "Solicitud",
      entidadId: s.id,
      accion: "EN_GESTION",
      detalle: {
        numeroReserva: reserva,
        ...(enviables.length > 1 ? { enLoteDe: enviables.length } : {}),
      },
    });
  }

  for (const s of enviables) {
    await avisarCambioDeEstado(s, "EN_GESTION", usuario.id);
  }

  const omitidas = solicitudes.length - enviables.length;
  const mensaje =
    enviables.length === 1
      ? "Pedido registrado con el almacén."
      : `Se registraron ${enviables.length} solicitudes como pedidas al almacén.`;

  await dejarAviso(
    omitidas > 0
      ? `${mensaje} ${omitidas} no estaba${
          omitidas === 1 ? "" : "n"
        } en condiciones de pedirse y quedó${
          omitidas === 1 ? "" : "aron"
        } sin cambios.`
      : mensaje,
  );

  revalidatePath("/solicitudes");
  revalidatePath("/escritorio");
  return { mensaje };
}
