import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { conToken, iso, leerPaginacion, respuestaLista } from "@/lib/api-respuesta";
import { UMBRAL_STOCK_BAJO } from "@/lib/bodega";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Inventario de bodega con su stock, para cruzarlo con otros inventarios.
 *
 * `stock` es lo disponible ahora mismo; lo prestado ya salió de ahí, así que se
 * informa aparte (`prestado`) para que la suma cuadre con lo que hay físicamente
 * a cargo de la empresa.
 */
export const GET = conToken(async (request, llamante) => {
  const url = new URL(request.url);
  const pagina = leerPaginacion(url);

  const where: Prisma.ItemBodegaWhereInput = { ...filtroEmpresa(llamante.alcance) };

  const activo = url.searchParams.get("activo");
  if (activo === "true" || activo === "false") where.activo = activo === "true";

  const q = url.searchParams.get("q")?.trim();
  if (q) {
    where.OR = [{ codigo: { contains: q } }, { nombre: { contains: q } }];
  }

  const [total, items] = await Promise.all([
    db.itemBodega.count({ where }),
    db.itemBodega.findMany({
      where,
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      skip: pagina.saltar,
      take: pagina.porPagina,
      select: {
        id: true,
        codigo: true,
        nombre: true,
        categoria: true,
        unidad: true,
        ubicacion: true,
        stock: true,
        activo: true,
        creadoEn: true,
        empresa: { select: { id: true, nombre: true } },
        lineasPrestamo: {
          where: { devueltoEn: null, prestamo: { estado: "ACTIVO" } },
          select: { cantidad: true },
        },
      },
    }),
  ]);

  return respuestaLista(
    items.map((i) => {
      const prestado = i.lineasPrestamo.reduce((s, l) => s + l.cantidad, 0);
      return {
        id: i.id,
        codigo: i.codigo,
        nombre: i.nombre,
        categoria: i.categoria,
        unidad: i.unidad,
        ubicacion: i.ubicacion,
        stock: i.stock,
        prestado,
        stockBajo: i.activo && i.stock <= UMBRAL_STOCK_BAJO,
        activo: i.activo,
        empresa: i.empresa,
        creadoEn: iso(i.creadoEn),
      };
    }),
    total,
    pagina,
  );
});
