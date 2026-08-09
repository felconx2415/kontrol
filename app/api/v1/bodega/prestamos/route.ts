import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { conToken, iso, leerPaginacion, respuestaLista } from "@/lib/api-respuesta";
import type { EstadoPrestamo } from "@/generated/prisma/enums";

/**
 * Préstamos de bodega: qué salió, a nombre de quién y si volvió.
 *
 * Por defecto solo los **activos**, que son los que representan material fuera
 * de la bodega y por tanto lo único accionable; con `?estado=DEVUELTO` se
 * consulta el histórico.
 *
 * La persona es texto libre —quien recibe un préstamo puede no tener cuenta— y
 * se devuelve tal cual está registrada.
 */
export const GET = conToken(async (request, llamante) => {
  const url = new URL(request.url);
  const pagina = leerPaginacion(url);

  const pedido = url.searchParams.get("estado");
  const estado: EstadoPrestamo =
    pedido === "DEVUELTO" ? "DEVUELTO" : "ACTIVO";

  // El préstamo llega a la empresa por los ítems que salieron de su bodega.
  const where = {
    estado,
    items: { some: { item: filtroEmpresa(llamante.alcance) } },
  };

  const [total, prestamos] = await Promise.all([
    db.prestamo.count({ where }),
    db.prestamo.findMany({
      where,
      orderBy: { prestadoEn: "desc" },
      skip: pagina.saltar,
      take: pagina.porPagina,
      select: {
        id: true,
        persona: true,
        estado: true,
        notas: true,
        prestadoEn: true,
        devueltoEn: true,
        observacionesDevolucion: true,
        prestadoPor: { select: { id: true, nombre: true } },
        items: {
          select: {
            id: true,
            cantidad: true,
            numeroSerie: true,
            devueltoEn: true,
            estadoDevolucion: true,
            observacion: true,
            item: {
              select: { id: true, codigo: true, nombre: true, unidad: true },
            },
          },
        },
      },
    }),
  ]);

  return respuestaLista(
    prestamos.map((p) => ({
      id: p.id,
      persona: p.persona,
      estado: p.estado,
      notas: p.notas,
      prestadoEn: iso(p.prestadoEn),
      prestadoPor: p.prestadoPor,
      devueltoEn: iso(p.devueltoEn),
      observacionesDevolucion: p.observacionesDevolucion,
      items: p.items.map((l) => ({
        id: l.id,
        item: l.item,
        cantidad: l.cantidad,
        numeroSerie: l.numeroSerie,
        devueltoEn: iso(l.devueltoEn),
        estadoDevolucion: l.estadoDevolucion,
        observacion: l.observacion,
      })),
    })),
    total,
    pagina,
  );
});
