import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { conToken, iso, leerPaginacion, respuestaLista } from "@/lib/api-respuesta";
import { formatearFolio } from "@/lib/folio";
import { estadoVencimiento } from "@/lib/vencimientos";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Qué tiene asignado cada persona: responde «¿quién tiene qué?».
 *
 * Sale de los ítems entregados, que es donde vive el equipamiento con nombre y
 * apellido —serie, fecha de entrega y vencimiento—. Por defecto solo lo
 * **vigente**: lo reemplazado ya no está en manos de nadie y mezclarlo daría un
 * inventario inflado. Con `?vigente=false` se ve también el histórico.
 */
export const GET = conToken(async (request, llamante) => {
  const url = new URL(request.url);
  const pagina = leerPaginacion(url);

  const where: Prisma.EntregaItemWhereInput = {
    // El equipamiento llega a la empresa por la solicitud que lo originó.
    entrega: { solicitud: filtroEmpresa(llamante.alcance) },
  };

  if (url.searchParams.get("vigente") !== "false") {
    where.reemplazadoEn = null;
  }

  const usuarioId = url.searchParams.get("usuarioId");
  const brigadaId = url.searchParams.get("brigadaId");
  if (usuarioId || brigadaId) {
    where.entrega = {
      solicitud: filtroEmpresa(llamante.alcance),
      ...(usuarioId ? { receptorId: usuarioId } : {}),
      ...(brigadaId ? { receptor: { brigadaId } } : {}),
    };
  }

  const [total, items] = await Promise.all([
    db.entregaItem.count({ where }),
    db.entregaItem.findMany({
      where,
      orderBy: { entrega: { entregadaEn: "desc" } },
      skip: pagina.saltar,
      take: pagina.porPagina,
      select: {
        id: true,
        cantidadEntregada: true,
        numeroSerie: true,
        venceEn: true,
        reemplazadoEn: true,
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
            solicitud: { select: { id: true, folio: true } },
          },
        },
        solicitudItem: {
          select: {
            articulo: {
              select: { codigo: true, nombre: true, categoria: true, unidad: true },
            },
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
      // El mismo cálculo que usa la interfaz, para que ambos digan lo mismo.
      estadoVencimiento: estadoVencimiento(i.venceEn),
      reemplazadoEn: iso(i.reemplazadoEn),
      solicitud: {
        id: i.entrega.solicitud.id,
        folio: formatearFolio(i.entrega.solicitud.folio),
      },
    })),
    total,
    pagina,
  );
});
