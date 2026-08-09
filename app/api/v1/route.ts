import { NextResponse } from "next/server";
import { conToken } from "@/lib/api-respuesta";

/**
 * Índice de la API.
 *
 * Se describe a sí misma para que quien la integra pueda empezar con una sola
 * llamada, sin ir a buscar el README. Es también la forma más rápida de
 * comprobar que un token funciona y qué alcanza.
 */
export const GET = conToken(async (_request, llamante) => {
  return NextResponse.json({
    api: "Kontrol",
    version: "v1",
    soloLectura: true,
    token: {
      nombre: llamante.nombre,
      alcance: llamante.alcance.todas
        ? "todas las empresas"
        : `${llamante.alcance.empresas.length} empresa(s)`,
    },
    recursos: {
      "/api/v1/solicitudes":
        "Solicitudes y su estado. Filtros: estado, tipo, brigadaId, desde, hasta, q.",
      "/api/v1/solicitudes/{id}":
        "Detalle de una solicitud, con sus ítems, reservas y entrega.",
      "/api/v1/equipamiento":
        "Qué tiene asignado cada persona. Filtros: usuarioId, brigadaId, vigente.",
      "/api/v1/vencimientos":
        "EPP vencido o por vencer. Filtro: dias (por defecto 30).",
      "/api/v1/bodega": "Inventario con su stock. Filtros: q, activo.",
      "/api/v1/bodega/prestamos":
        "Préstamos de bodega. Filtro: estado (ACTIVO, DEVUELTO).",
    },
    paginacion:
      "Los listados aceptan ?pagina= y ?porPagina= (máximo 200) y devuelven { datos, pagina, porPagina, total, totalPaginas }.",
    fechas: "Todas en ISO 8601 con zona horaria.",
  });
});
