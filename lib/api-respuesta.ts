import "server-only";

import { NextResponse } from "next/server";
import { autenticarToken, type Llamante } from "@/lib/api-token";

/**
 * Forma común de las respuestas de /api/v1.
 *
 * Todas las rutas devuelven lo mismo —listado con `datos` y paginación, o un
 * objeto suelto— para que quien la consume escriba el cliente una vez. Los
 * errores siempre traen `error` con una frase legible: al otro lado hay una
 * persona depurando su integración, no solo un programa.
 */

export const POR_PAGINA_MAXIMO = 200;
export const POR_PAGINA_DEFECTO = 50;

export type Pagina = { pagina: number; porPagina: number; saltar: number };

/** Lee `?pagina=` y `?porPagina=` con topes, para que nadie pida la base entera. */
export function leerPaginacion(url: URL): Pagina {
  const pagina = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const pedido = Number(url.searchParams.get("porPagina")) || POR_PAGINA_DEFECTO;
  const porPagina = Math.min(Math.max(1, pedido), POR_PAGINA_MAXIMO);

  return { pagina, porPagina, saltar: (pagina - 1) * porPagina };
}

export function respuestaLista<T>(
  datos: T[],
  total: number,
  { pagina, porPagina }: Pagina,
) {
  return NextResponse.json({
    datos,
    pagina,
    porPagina,
    total,
    totalPaginas: Math.ceil(total / porPagina),
  });
}

export function error(mensaje: string, estado: number) {
  return NextResponse.json({ error: mensaje }, { status: estado });
}

/**
 * Envuelve un manejador GET resolviendo antes la autenticación.
 *
 * Va aquí y no en cada ruta para que una ruta nueva no pueda nacer abierta: si
 * se olvida el envoltorio, no hay `llamante` que usar y no compila.
 */
// El contexto por defecto es `unknown` y no `undefined`: Next siempre pasa un
// segundo argumento —en las rutas estáticas, `{ params: Promise<{}> }`— y una
// firma que lo declarara ausente no encajaría con el tipo que valida el router.
export function conToken<Contexto = unknown>(
  manejador: (
    request: Request,
    llamante: Llamante,
    // Lo que Next pasa como segundo argumento; en las rutas dinámicas trae los
    // `params`, y en las demás no se usa.
    contexto: Contexto,
  ) => Promise<NextResponse> | NextResponse,
) {
  return async (request: Request, contexto: Contexto) => {
    const llamante = await autenticarToken(request);
    if (!llamante) {
      return NextResponse.json(
        {
          error:
            "Token ausente, inválido o revocado. Envía la cabecera «Authorization: Bearer kt_…».",
        },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      );
    }

    try {
      return await manejador(request, llamante, contexto);
    } catch (e) {
      // Nunca se filtra el detalle interno: podría describir el esquema a
      // alguien que solo debería ver datos.
      console.error("[api/v1]", e);
      return error("Error al procesar la consulta.", 500);
    }
  };
}

/** Convierte un `Date` a ISO, o null. Todas las fechas de la API van en ISO. */
export const iso = (f: Date | null | undefined) => f?.toISOString() ?? null;
