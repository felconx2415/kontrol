import "server-only";

/**
 * URL pública por la que se está usando la app.
 *
 * Detrás de un proxy inverso (Caddy, en este despliegue) la petición que llega
 * a Next viene por la red interna, así que `request.url` dice `localhost:3000`
 * y no el dominio real. Un QR construido con eso apunta a la máquina de quien
 * escanea: inútil.
 *
 * El dominio verdadero viaja en las cabeceras que pone el proxy. Se prueban en
 * orden de fiabilidad y solo al final se cae a la URL de la petición, que es lo
 * correcto en desarrollo, donde no hay proxy delante.
 */
export function origenPublico(request: Request): string | null {
  const cabeceras = request.headers;

  // Preferencia explícita, por si algún día el proxy no reenvía cabeceras.
  const configurado = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configurado) return configurado;

  const host =
    cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? null;

  if (host && !/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host)) {
    const protocolo = cabeceras.get("x-forwarded-proto")?.split(",")[0].trim();
    return `${protocolo || "https"}://${host}`;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}
