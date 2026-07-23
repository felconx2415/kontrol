import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { BotonEnlace } from "@/components/ui/boton";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { Seccion, Vacio } from "@/components/ui/superficie";
import FormularioItem from "./formulario-item";
import FormularioItemCatalogo from "./formulario-item-catalogo";
import FormularioMovimiento, { type OpcionItem } from "./formulario-movimiento";
import FilaItemBodega from "./fila-item";

export const metadata = { title: "Bodega · Kontrol" };

const fecha = (d: Date) =>
  d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

export default async function PaginaBodega() {
  await requerirRol(...ROLES_GESTION);

  const [items, prestamos, articulos] = await Promise.all([
    db.itemBodega.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        prestamos: { where: { estado: "ACTIVO" }, select: { cantidad: true } },
      },
    }),
    db.prestamo.findMany({
      where: { estado: "ACTIVO" },
      orderBy: { prestadoEn: "asc" },
      include: {
        item: { select: { id: true, nombre: true, unidad: true } },
        prestadoPor: { select: { nombre: true } },
      },
    }),
    db.articulo.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, codigo: true, nombre: true, categoria: true },
    }),
  ]);

  // Del catálogo solo se ofrecen los que aún no están en la bodega (por código).
  const codigosEnBodega = new Set(items.map((i) => i.codigo));
  const articulosDisponibles = articulos.filter(
    (a) => !codigosEnBodega.has(a.codigo),
  );

  const opciones: OpcionItem[] = items
    .filter((i) => i.activo)
    .map((i) => ({
      id: i.id,
      codigo: i.codigo,
      nombre: i.nombre,
      unidad: i.unidad,
      stock: i.stock,
    }));

  // Resumen de cabecera.
  const totalUnidades = items.reduce((s, i) => s + i.stock, 0);
  const totalPrestado = prestamos.reduce((s, p) => s + p.cantidad, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Bodega local</h1>
        <p className="text-sm text-tinta-suave">
          Inventario físico gestionado dentro de Kontrol. Ingresa material, sácalo
          en forma definitiva o préstalo con devolución. Cada movimiento queda
          registrado.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          { t: "Ítems", v: items.length },
          { t: "Unidades en stock", v: totalUnidades },
          { t: "Prestadas", v: totalPrestado },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border border-borde bg-panel p-4">
            <dt className="text-xs text-tinta-tenue">{k.t}</dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-tinta">
              {k.v}
            </dd>
          </div>
        ))}
      </dl>

      <FormularioItem />

      {articulosDisponibles.length > 0 && (
        <FormularioItemCatalogo articulos={articulosDisponibles} />
      )}

      {opciones.length > 0 ? (
        <>
          <FormularioMovimiento items={opciones} />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-panel p-4">
            <p className="text-sm text-tinta-suave">
              Prestar un ítem genera un acta firmada de salida y de devolución.
            </p>
            <BotonEnlace href="/bodega/prestar" variante="secundario" tamano="sm">
              Prestar ítem
            </BotonEnlace>
          </div>
        </>
      ) : (
        <p className="text-sm text-tinta-suave">
          Agrega un ítem para empezar a registrar movimientos.
        </p>
      )}

      {prestamos.length > 0 && (
        <Seccion titulo={`Préstamos activos (${prestamos.length})`} plano>
          <Tabla
            encabezados={[
              "Ítem",
              "Cantidad",
              "Prestado a",
              "Registró",
              "Fecha",
              { texto: "", alineado: "der" },
            ]}
          >
            {prestamos.map((p) => (
              <Fila key={p.id}>
                <Celda etiqueta="Ítem">
                  <Link
                    href={`/bodega/${p.item.id}`}
                    className="foco-anillo rounded font-medium text-marca-700 underline-offset-2 hover:underline"
                  >
                    {p.item.nombre}
                  </Link>
                </Celda>
                <Celda etiqueta="Cantidad" mono>
                  {p.cantidad} {p.item.unidad}
                </Celda>
                <Celda etiqueta="Prestado a">{p.persona}</Celda>
                <Celda etiqueta="Registró" tenue>
                  {p.prestadoPor.nombre}
                </Celda>
                <Celda etiqueta="Fecha" tenue>
                  {fecha(p.prestadoEn)}
                </Celda>
                <Celda derecha completa>
                  <div className="flex flex-wrap justify-end gap-1">
                    <a
                      href={`/api/bodega/prestamos/${p.id}/acta`}
                      className="foco-anillo inline-flex min-h-11 items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta"
                    >
                      Acta
                    </a>
                    <Link
                      href={`/bodega/prestamos/${p.id}/devolver`}
                      className="foco-anillo inline-flex min-h-11 items-center rounded px-2 text-xs font-medium text-marca-700 underline underline-offset-2 transition-colors duration-150 hover:text-marca-800"
                    >
                      Registrar devolución
                    </Link>
                  </div>
                </Celda>
              </Fila>
            ))}
          </Tabla>
        </Seccion>
      )}

      <Seccion titulo="Inventario" plano>
        {items.length === 0 ? (
          <div className="p-4">
            <Vacio mensaje="Aún no hay ítems en la bodega." />
          </div>
        ) : (
          <Tabla
            encabezados={[
              "Código",
              "Nombre",
              "Categoría",
              "Ubicación",
              { texto: "Stock", alineado: "der" },
              { texto: "Prestado", alineado: "der" },
              "Estado",
              { texto: "", alineado: "der" },
            ]}
            anchoMinimo="52rem"
          >
            {items.map((i) => (
              <FilaItemBodega
                key={i.id}
                item={{
                  id: i.id,
                  codigo: i.codigo,
                  nombre: i.nombre,
                  categoria: i.categoria,
                  unidad: i.unidad,
                  ubicacion: i.ubicacion,
                  notas: i.notas,
                  stock: i.stock,
                  prestado: i.prestamos.reduce((s, p) => s + p.cantidad, 0),
                  activo: i.activo,
                }}
              />
            ))}
          </Tabla>
        )}
      </Seccion>
    </div>
  );
}
