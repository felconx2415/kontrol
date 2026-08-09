"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { marcarLeida, marcarTodasLeidas } from "@/lib/notificaciones";

/**
 * Marca una notificación como leída y lleva a donde apunta.
 *
 * Las dos cosas van juntas a propósito: leer el aviso es abrirlo, y obligar a
 * marcarlo aparte dejaría la campana con un número que nadie baja.
 */
export async function abrirNotificacion(formData: FormData) {
  const usuario = await requerirUsuario();

  const id = String(formData.get("notificacionId") ?? "");
  const destino = String(formData.get("url") ?? "");

  await marcarLeida(usuario.id, id);

  revalidatePath("/notificaciones");
  // Las rutas externas o absolutas no se siguen: el destino sale de la base,
  // pero redirigir a lo que venga en un campo del formulario no es algo que
  // deba poder pasar.
  redirect(destino.startsWith("/") ? destino : "/notificaciones");
}

export async function marcarTodo() {
  const usuario = await requerirUsuario();

  await marcarTodasLeidas(usuario.id);

  revalidatePath("/notificaciones");
  revalidatePath("/escritorio");
  redirect("/notificaciones");
}
