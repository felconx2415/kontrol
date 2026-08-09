import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { ALCANCE_TOTAL, type Alcance } from "@/lib/alcance";

/**
 * Credenciales de la API de consulta.
 *
 * El token es una cadena aleatoria de 32 bytes con un prefijo reconocible. De
 * él solo se guarda el **hash**: si alguien lee la base no obtiene una llave
 * utilizable, y ni siquiera nosotros podemos volver a mostrarlo. Se enseña una
 * vez al crearlo y se acabó.
 *
 * El hash es SHA-256 y no bcrypt, a diferencia de las contraseñas. Ahí el
 * costo alto es la defensa: una contraseña la elige una persona y se puede
 * adivinar. Aquí el secreto tiene 256 bits de azar, así que no hay nada que
 * adivinar, y en cambio el hash se calcula en **cada petición**: bcrypt
 * convertiría la API en su propio cuello de botella.
 */

/** Se antepone al valor para reconocerlo de un vistazo en un `.env` ajeno. */
const PREFIJO = "kt_";

/** Cuántos caracteres del token se guardan en claro para identificarlo. */
const LARGO_PREFIJO = PREFIJO.length + 6;

export type TokenNuevo = { valor: string; prefijo: string; hash: string };

/** Crea un token nuevo. El `valor` es lo único que no vuelve a existir. */
export function generarToken(): TokenNuevo {
  const valor = PREFIJO + randomBytes(32).toString("base64url");
  return {
    valor,
    prefijo: valor.slice(0, LARGO_PREFIJO),
    hash: hashDeToken(valor),
  };
}

export function hashDeToken(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/** Quién está llamando: el token y hasta dónde alcanza. */
export type Llamante = {
  tokenId: string;
  nombre: string;
  /** Reutiliza el alcance del resto del sistema (ver lib/alcance.ts). */
  alcance: Alcance;
};

/**
 * Cada cuánto se refresca `ultimoUsoEn`. La API es de solo lectura y esta es la
 * única escritura que hace: sin ella no habría forma de saber qué tokens siguen
 * vivos y cuáles se pueden retirar. Se limita a una vez por hora para que un
 * tablero que consulta cada minuto no escriba en la base cada minuto.
 */
const REFRESCO_DE_USO_MS = 60 * 60 * 1000;

/**
 * Resuelve el `Authorization: Bearer …` de la petición.
 *
 * Devuelve null si falta, está mal formado, no existe o fue revocado: desde
 * fuera los cuatro casos son el mismo 401, para no ir confirmando qué tokens
 * existen a quien va probando.
 */
export async function autenticarToken(request: Request): Promise<Llamante | null> {
  const cabecera = request.headers.get("authorization") ?? "";
  const [esquema, valor] = cabecera.split(" ");

  if (esquema?.toLowerCase() !== "bearer" || !valor) return null;
  if (!valor.startsWith(PREFIJO)) return null;

  const token = await db.tokenApi.findUnique({
    where: { hash: hashDeToken(valor) },
    select: {
      id: true,
      nombre: true,
      hash: true,
      empresaId: true,
      revocadoEn: true,
      ultimoUsoEn: true,
      empresa: { select: { activa: true } },
    },
  });

  if (!token || token.revocadoEn) return null;

  // La búsqueda por hash ya es exacta; esta comparación en tiempo constante
  // existe para que el camino del token válido y el del inválido no difieran de
  // forma medible.
  const esperado = Buffer.from(token.hash, "hex");
  const recibido = Buffer.from(hashDeToken(valor), "hex");
  if (esperado.length !== recibido.length) return null;
  if (!timingSafeEqual(esperado, recibido)) return null;

  // Una empresa desactivada deja de responder por su token: es lo mismo que
  // sacarla de circulación en la interfaz.
  if (token.empresaId && token.empresa && !token.empresa.activa) return null;

  const desactualizado =
    !token.ultimoUsoEn ||
    Date.now() - token.ultimoUsoEn.getTime() > REFRESCO_DE_USO_MS;

  if (desactualizado) {
    await db.tokenApi.update({
      where: { id: token.id },
      data: { ultimoUsoEn: new Date() },
    });
  }

  return {
    tokenId: token.id,
    nombre: token.nombre,
    alcance: token.empresaId
      ? { todas: false, empresas: [token.empresaId] }
      : ALCANCE_TOTAL,
  };
}
