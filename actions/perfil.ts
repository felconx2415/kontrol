"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirRol } from "@/lib/auth";
import { bufferDesdeDataUrl, guardarImagen } from "@/lib/archivos";
import { dejarAviso } from "@/lib/avisos";
import { ROLES_GESTION } from "@/lib/solicitud-estado";

export type EstadoPerfil = { error?: string; ok?: string };

/**
 * Guarda la firma del perfil.
 *
 * Solo la usa gestión: son quienes entregan material y aparecen como «quien
 * entrega» en cada acta. Firmar a mano cada documento emitido es inviable, así
 * que la firma se registra una vez y el sistema la estampa. Quien recibe sigue
 * firmando en el momento, que es lo que da valor al acta.
 */
export async function guardarFirmaPerfil(
  _estado: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const firma = bufferDesdeDataUrl(String(formData.get("firma") ?? ""));
  if (!firma) return { error: "Dibuja tu firma antes de guardarla." };

  const firmaPngUrl = await guardarImagen(firma, "image/png", "firmas");

  await db.usuario.update({
    where: { id: usuario.id },
    data: { firmaPngUrl },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Usuario",
    entidadId: usuario.id,
    accion: "FIRMA_ACTUALIZADA",
  });

  await dejarAviso("Firma guardada. Se usará en los documentos que emitas.");
  revalidatePath("/perfil");
  return { ok: "Firma guardada." };
}

/** Quita la firma del perfil: los documentos vuelven a dejar el espacio libre. */
export async function quitarFirmaPerfil(): Promise<EstadoPerfil> {
  const usuario = await requerirRol(...ROLES_GESTION);

  await db.usuario.update({
    where: { id: usuario.id },
    data: { firmaPngUrl: null },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Usuario",
    entidadId: usuario.id,
    accion: "FIRMA_ELIMINADA",
  });

  await dejarAviso("Firma eliminada. Los documentos dejarán el espacio en blanco.");
  revalidatePath("/perfil");
  return { ok: "Firma eliminada." };
}
