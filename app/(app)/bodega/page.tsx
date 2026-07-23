import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import Boton, { BotonEnlace } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { Vacio } from "@/components/ui/superficie";
import Insignia from "@/components/ui/insignia";
import Paginacion from "@/components/ui/paginacion";
import {
  cantidadConSigno,
  COLOR_MOVIMIENTO,
  ETIQUETA_MOVIMIENTO,
  UMBRAL_STOCK_BAJO,
} from "@/lib/bodega";
import BarraAcciones from "./barra-acciones";
import FormularioItem from "./formulario-item";
import FormularioItemCatalogo from "./formulario-item-catalogo";
import FormularioMovimiento, { type OpcionItem } from "./formulario-movimiento";
import FilaItemBodega from "./fila-item";

export const metadata = { title: "Bodega · Kontrol" };

const POR_PAGINA = 10;

type Tab = "inventario" | "prestamos" | "movimientos";
const TABS: { id: Tab; texto: string }[] = [
  { id: "inventario", texto: "Inventario" },
  { id: "prestamos", texto: "Préstamos" },
  { id: "movimientos", texto: "Movimientos" },
];

const fecha = (d: Date) =>
  d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

const fechaHora = (d: Date) =>
  d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function PaginaBodega({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    cat?: string;
    estado?: string;
    stock?: string;
    page?: string;
  }>;
}) {
  await requerirRol(...ROLES_GESTION);
  const { tab: tabParam, q, cat, estado, stock, page } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "inventario";
  const pagina = Math.max(1, Number(page) || 1);

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
  const stockBajo = items.filter(
    (i) => i.activo && i.stock <= UMBRAL_STOCK_BAJO,
  ).length;

  // Categorías presentes, para el filtro del inventario.
  const categorias = [...new Set(items.map((i) => i.categoria))].sort();

  // Filtro del inventario (sobre la lista ya cargada: son pocos ítems).
  const termino = q?.trim().toLowerCase();
  const inventario = items.filter((i) => {
    if (cat && i.categoria !== cat) return false;
    if (estado === "activos" && !i.activo) return false;
    if (estado === "inactivos" && i.activo) return false;
    if (stock === "bajo" && !(i.activo && i.stock <= UMBRAL_STOCK_BAJO)) return false;
    if (
      termino &&
      !i.codigo.toLowerCase().includes(termino) &&
      !i.nombre.toLowerCase().includes(termino)
    )
      return false;
    return true;
  });

  const totalPaginasInv = Math.ceil(inventario.length / POR_PAGINA);
  const itemsPagina = inventario.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Historial global de movimientos (solo se consulta en su pestaña).
  let movimientos: Awaited<ReturnType<typeof cargarMovimientos>>["filas"] = [];
  let totalPaginasMov = 0;
  if (tab === "movimientos") {
    const res = await cargarMovimientos(pagina);
    movimientos = res.filas;
    totalPaginasMov = Math.ceil(res.total / POR_PAGINA);
  }

  const hrefInv = (p: number) => {
    const sp = new URLSearchParams({ tab: "inventario" });
    if (q) sp.set("q", q);
    if (cat) sp.set("cat", cat);
    if (estado) sp.set("estado", estado);
    if (stock) sp.set("stock", stock);
    sp.set("page", String(p));
    return `/bodega?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Bodega local</h1>
          <p className="text-sm text-tinta-suave">
            Inventario físico gestionado dentro de Kontrol. Ingresa material,
            sácalo, préstalo o asígnalo. Cada movimiento queda registrado.
          </p>
        </div>
        <a
          href="/api/bodega/pdf"
          className="foco-anillo inline-flex min-h-11 items-center rounded-lg border border-borde-fuerte bg-panel px-4 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-panel-suave"
        >
          Exportar PDF
        </a>
      </div>

      <BarraAcciones
        formularioItem={<FormularioItem />}
        formularioCatalogo={
          articulosDisponibles.length > 0 ? (
            <FormularioItemCatalogo articulos={articulosDisponibles} />
          ) : null
        }
        formularioMovimiento={
          opciones.length > 0 ? <FormularioMovimiento items={opciones} /> : null
        }
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <Link
          href="/bodega?tab=inventario&stock=bajo"
          className={`foco-anillo rounded-xl border p-4 transition-colors duration-150 ${
            stockBajo > 0
              ? "border-espera-borde bg-espera-fondo hover:bg-espera-fondo/70"
              : "border-borde bg-panel hover:bg-panel-suave"
          }`}
        >
          <dt className={`text-xs ${stockBajo > 0 ? "text-espera" : "text-tinta-tenue"}`}>
            Stock bajo (≤{UMBRAL_STOCK_BAJO})
          </dt>
          <dd
            className={`mt-0.5 text-2xl font-semibold tabular-nums ${
              stockBajo > 0 ? "text-espera" : "text-tinta"
            }`}
          >
            {stockBajo}
          </dd>
        </Link>
      </dl>

      <nav className="flex gap-1 overflow-x-auto border-b border-borde">
        {TABS.map((t) => {
          const activo = t.id === tab;
          const cuenta =
            t.id === "prestamos" && prestamos.length > 0 ? ` (${prestamos.length})` : "";
          return (
            <Link
              key={t.id}
              href={`/bodega?tab=${t.id}`}
              className={`foco-anillo -mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium transition-colors duration-150 ${
                activo
                  ? "border-marca-600 text-tinta"
                  : "border-transparent text-tinta-suave hover:text-tinta"
              }`}
            >
              {t.texto}
              {cuenta}
            </Link>
          );
        })}
      </nav>

      {tab === "inventario" && (
        <div className="space-y-4">
          <form className="flex flex-wrap items-end gap-3 rounded-xl border border-borde bg-panel p-4">
            <input type="hidden" name="tab" value="inventario" />
            <Campo etiqueta="Buscar" htmlFor="q" className="min-w-0 flex-1">
              <Entrada
                id="q"
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Código o nombre…"
              />
            </Campo>
            <Campo etiqueta="Categoría" htmlFor="cat">
              <Seleccion id="cat" name="cat" defaultValue={cat ?? ""}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Estado" htmlFor="estado">
              <Seleccion id="estado" name="estado" defaultValue={estado ?? ""}>
                <option value="">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </Seleccion>
            </Campo>
            <Campo etiqueta="Stock" htmlFor="stock">
              <Seleccion id="stock" name="stock" defaultValue={stock ?? ""}>
                <option value="">Todos</option>
                <option value="bajo">Stock bajo</option>
              </Seleccion>
            </Campo>
            <Boton type="submit" variante="secundario" className="mb-0.5">
              Filtrar
            </Boton>
          </form>

          {inventario.length === 0 ? (
            <Vacio
              mensaje={
                items.length === 0
                  ? "Aún no hay ítems en la bodega. Agrega uno para empezar."
                  : "Ningún ítem coincide con el filtro."
              }
            />
          ) : (
            <>
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
                {itemsPagina.map((i) => (
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

              <Paginacion
                paginaActual={pagina}
                totalPaginas={totalPaginasInv}
                href={hrefInv}
              />
            </>
          )}
        </div>
      )}

      {tab === "prestamos" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <BotonEnlace href="/bodega/prestar" tamano="sm">
              Nuevo préstamo
            </BotonEnlace>
          </div>
          {prestamos.length === 0 ? (
            <Vacio mensaje="No hay préstamos activos." />
          ) : (
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
          )}
        </div>
      )}

      {tab === "movimientos" && (
        <div className="space-y-4">
          {movimientos.length === 0 ? (
            <Vacio mensaje="Todavía no hay movimientos registrados." />
          ) : (
            <>
              <Tabla
                encabezados={[
                  "Fecha",
                  "Ítem",
                  "Tipo",
                  { texto: "Cantidad", alineado: "der" },
                  { texto: "Stock", alineado: "der" },
                  "Persona",
                  "Registró",
                  "Nota",
                ]}
                anchoMinimo="56rem"
              >
                {movimientos.map((m) => (
                  <Fila key={m.id}>
                    <Celda etiqueta="Fecha" tenue>
                      {fechaHora(m.creadoEn)}
                    </Celda>
                    <Celda etiqueta="Ítem">
                      <Link
                        href={`/bodega/${m.item.id}`}
                        className="foco-anillo rounded font-medium text-marca-700 underline-offset-2 hover:underline"
                      >
                        {m.item.nombre}
                      </Link>
                    </Celda>
                    <Celda etiqueta="Tipo">
                      <Insignia clases={COLOR_MOVIMIENTO[m.tipo]}>
                        {ETIQUETA_MOVIMIENTO[m.tipo]}
                      </Insignia>
                    </Celda>
                    <Celda etiqueta="Cantidad" derecha mono>
                      {cantidadConSigno(m.tipo, m.cantidad)}
                    </Celda>
                    <Celda etiqueta="Stock" derecha mono tenue>
                      {m.stockResultante}
                    </Celda>
                    <Celda etiqueta="Persona" tenue>
                      {m.persona ?? "—"}
                    </Celda>
                    <Celda etiqueta="Registró" tenue>
                      {m.usuario.nombre}
                    </Celda>
                    <Celda etiqueta="Nota" tenue>
                      {m.notas ?? "—"}
                    </Celda>
                  </Fila>
                ))}
              </Tabla>

              <Paginacion
                paginaActual={pagina}
                totalPaginas={totalPaginasMov}
                href={(p) => `/bodega?tab=movimientos&page=${p}`}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Página del historial global de movimientos, ordenado del más reciente. */
async function cargarMovimientos(pagina: number) {
  const [total, filas] = await Promise.all([
    db.movimientoBodega.count(),
    db.movimientoBodega.findMany({
      orderBy: { creadoEn: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        item: { select: { id: true, nombre: true, unidad: true } },
        usuario: { select: { nombre: true } },
      },
    }),
  ]);
  return { total, filas };
}
