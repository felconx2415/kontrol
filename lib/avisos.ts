import "server-only";

import { cookies } from "next/headers";

export const COOKIE_AVISO = "kontrol_aviso";

/**
 * Deja un mensaje de confirmación para la siguiente pantalla.
 *
 * Va en cookie y no en la URL a propósito: un `?ok=…` quedaría pegado al
 * enlace que el usuario copia y compartiría el mensaje fuera de contexto.
 * Solo puede llamarse desde una Server Action o un Route Handler.
 */
export async function dejarAviso(mensaje: string) {
  (await cookies()).set(COOKIE_AVISO, mensaje, {
    httpOnly: false, // lo borra el componente cliente tras mostrarlo
    sameSite: "lax",
    path: "/",
    maxAge: 30,
  });
}
