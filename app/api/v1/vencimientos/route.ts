import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { conToken, iso, leerPaginacion, respuestaLista } from "@/lib/api-respuesta";
import {
  DIAS_AVISO_VENCIMIENTO,
  diasRestantes,
  estadoVencimiento,
} from "@/lib/vencimientos";

/**
 * EPP vencido o próximo a vencer, para alimentar alertas fuera de Kontrol.
 *
 * Incluye lo ya vencido siempre: son los que exigen acción hoy, y una lista de
 * «próximos vencimientos» que los omitiera dejaría fuera justo lo urgente. Con
 * `?dias=` se estira o encoge la ventana hacia adelante.
 *
 * Lo que ya tiene un reemplazo en curso se marca en vez de esconderse: sigue
 * vencido, pero alguien ya se hizo cargo.
 */
export const GET = conToken(async (request, llamante) => {
  const url = new URL(request.url);
  const pagina = leerPaginacion(url);

  const pedidos = Number(url.searchParams.get("dias"));
  const dias = Number.isFinite(pedidos) && pedidos >= 0 ? pedidos : DIAS_AVISO_VENCIMIENTO;

  const corte = new Date();
  corte.setDate(corte.getDate() + dias);

  const where = {
    reemplazadoEn: null,
    venceEn: { not: null, lte: corte },
    entrega: { solicitud: filtroEmpresa(llamante.alcance) },
  } as const;

  const [total, items] = await Promise.all([
    db.entregaItem.count({ where }),
    db.entregaItem.findMany({
      where,
      orderBy: { venceEn: "asc" }, // lo más urgente primero
      skip: pagina.saltar,
      take: pagina.porPagina,
      select: {
        id: true,
        venceEn: true,
        numeroSerie: true,
        cantidadEntregada: true,
        reemplazadoPor: { select: { id: true, solicitudId: true } },
        entrega: {
          select: {
            entregadaEn: true,
            receptor: {
              select: {
                id: true,
                nombre: true,
                rut: true,
                brigada: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        solicitudItem: {
          select: {
            articulo: { select: { codigo: true, nombre: true, categoria: true } },
          },
        },
      },
    }),
  ]);

  return respuestaLista(
    items.map((i) => ({
      id: i.id,
      persona: i.entrega.receptor,
      articulo: i.solicitudItem.articulo,
      cantidad: i.cantidadEntregada,
      numeroSerie: i.numeroSerie,
      entregadoEn: iso(i.entrega.entregadaEn),
      venceEn: iso(i.venceEn),
      diasRestantes: i.venceEn ? diasRestantes(i.venceEn) : null,
      estado: estadoVencimiento(i.venceEn),
      reemplazoEnCurso: i.reemplazadoPor !== null,
    })),
    total,
    pagina,
  );
});
