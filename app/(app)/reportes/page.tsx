import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha } from "@/lib/vencimientos";
import { ETIQUETA_ESTADO, ROLES_GESTION } from "@/lib/solicitud-estado";
import EstadoBadge from "@/components/estado-badge";
import Insignia from "@/components/ui/insignia";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, Vacio } from "@/components/ui/superficie";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import Paginacion from "@/components/ui/paginacion";
import { Seccion } from "@/components/ui/superficie";
import {
  construirFiltro,
  construirRangoFechas,
  type FiltrosReporte,
} from "@/lib/reportes";
import { filtroEmpresa } from "@/lib/alcance";
import { duenoAsignacion } from "@/lib/bodega";
import type { EstadoSolicitud } from "@/generated/prisma/enums";

export const metadata = { title: "Reportes · Kontrol" };

const ESTADOS: EstadoSolicitud[] = [
  "PENDIENTE",
  "APROBADA",
  "RESERVA_SOLICITADA",
  "EN_GESTION",
  "RECIBIDA",
  "ENTREGADA",
  "RECHAZADA",
  "CANCELADA",
];

const POR_PAGINA = 25;

/** Estados que siguen en curso: ni entregados ni detenidos. */
const EN_CURSO: EstadoSolicitud[] = [
  "PENDIENTE",
  "APROBADA",
  "RESERVA_SOLICITADA",
  "EN_GESTION",
  "RECIBIDA",
];

type Vista = "solicitudes" | "prestamos" | "traslados";

export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<FiltrosReporte & { vista?: string; page?: string }>;
}) {
  const usuario = await requerirRol(...ROLES_GESTION);
  // `vista` y `page` son de esta pantalla, no del filtro: no viajan al Excel
  // ni a las consultas.
  const { vista: vistaParam, page, ...filtros } = await searchParams;
  const vista: Vista =
    vistaParam === "prestamos" || vistaParam === "traslados" ? vistaParam : "solicitudes";
  const pagina = Math.max(1, Number(page) || 1);
  const whereSolicitudes = construirFiltro(filtros, usuario.alcance);

  // El rango de fechas se aplica también a la bodega (préstamos por prestadoEn,
  // traslados por asignadoEn). Los filtros de estado/categoría son propios de
  // las solicitudes; brigada sí acota los traslados por la brigada del usuario.
  const rango = construirRangoFechas(filtros);
  const deMiEmpresa = filtroEmpresa(usuario.alcance);

  const [brigadas, porEstado, solicitudes, prestamos, traslados] = await Promise.all([
    db.brigada.findMany({ where: deMiEmpresa, orderBy: { nombre: "asc" } }),
    // El resumen cuenta todo el período, no solo la página que se ve.
    db.solicitud.groupBy({
      by: ["estado"],
      where: whereSolicitudes,
      _count: { _all: true },
    }),
    db.solicitud.findMany({
      where: whereSolicitudes,
      orderBy: { creadaEn: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        solicitante: { select: { nombre: true, cargo: { select: { nombre: true } } } },
        brigada: { select: { nombre: true } },
        _count: { select: { items: true } },
      },
    }),
    db.prestamoItem.findMany({
      // El préstamo llega a la empresa por el ítem de bodega que salió.
      where: {
        item: deMiEmpresa,
        ...(rango ? { prestamo: { prestadoEn: rango } } : {}),
      },
      orderBy: { prestamo: { prestadoEn: "desc" } },
      take: 200,
      include: {
        item: { select: { codigo: true, nombre: true, unidad: true } },
        prestamo: {
          select: {
            persona: true,
            estado: true,
            prestadoEn: true,
            prestadoPor: { select: { nombre: true } },
          },
        },
      },
    }),
    db.asignacionItem.findMany({
      // La entrega llega a la empresa por el ítem de bodega que salió.
      where: {
        item: deMiEmpresa,
        ...(rango || filtros.brigadaId
          ? {
              asignacion: {
                ...(rango ? { asignadoEn: rango } : {}),
                // Lo de la brigada es lo que tiene su gente **y** lo que es de
                // la brigada misma: filtrar solo por sus miembros dejaría fuera
                // la motosierra que es de la cuadrilla.
                ...(filtros.brigadaId
                  ? {
                      OR: [
                        { usuario: { brigadaId: filtros.brigadaId } },
                        { brigadaId: filtros.brigadaId },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: { asignacion: { asignadoEn: "desc" } },
      take: 200,
      include: {
        item: { select: { codigo: true, nombre: true, unidad: true } },
        asignacion: {
          select: {
            asignadoEn: true,
            notas: true,
            usuario: {
              select: {
                id: true,
                nombre: true,
                brigada: { select: { nombre: true } },
                cargo: { select: { nombre: true } },
              },
            },
            brigada: { select: { id: true, nombre: true } },
            asignadoPor: { select: { nombre: true } },
          },
        },
      },
    }),
  ]);

  const prestamosActivos = prestamos.filter((l) => l.devueltoEn === null).length;

  const cuenta = (estados: EstadoSolicitud[]) =>
    porEstado
      .filter((g) => estados.includes(g.estado))
      .reduce((total, g) => total + g._count._all, 0);
  const totalSolicitudes = porEstado.reduce((t, g) => t + g._count._all, 0);
  const totalPaginas = Math.ceil(totalSolicitudes / POR_PAGINA);

  const parametros = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => Boolean(v)) as [string, string][],
  );

  // Cambiar de pestaña o de página conserva los filtros.
  const hrefVista = (v: Vista, p?: number) => {
    const sp = new URLSearchParams(parametros);
    if (v !== "solicitudes") sp.set("vista", v);
    if (p && p > 1) sp.set("page", String(p));
    const q = sp.toString();
    return `/reportes${q ? `?${q}` : ""}`;
  };

  const resumen: { texto: string; valor: number; nota?: string }[] = [
    { texto: "Solicitudes", valor: totalSolicitudes, nota: "en el período" },
    { texto: "En curso", valor: cuenta(EN_CURSO), nota: "aún sin entregar" },
    { texto: "Entregadas", valor: cuenta(["ENTREGADA"]) },
    { texto: "Rechazadas o canceladas", valor: cuenta(["RECHAZADA", "CANCELADA"]) },
    {
      texto: "Préstamos activos",
      valor: prestamosActivos,
      nota: `de ${prestamos.length} en el período`,
    },
    { texto: "Traslados", valor: traslados.length, nota: "equipamiento asignado" },
  ];

  const pestanas: { id: Vista; texto: string; cuenta: number }[] = [
    { id: "solicitudes", texto: "Solicitudes", cuenta: totalSolicitudes },
    { id: "prestamos", texto: "Préstamos", cuenta: prestamos.length },
    { id: "traslados", texto: "Traslados", cuenta: traslados.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Reportes</h1>
          <p className="text-sm text-tinta-suave">
            Solicitudes, préstamos y traslados del período filtrado. El Excel
            lleva las tres hojas completas.
          </p>
        </div>
        <a
          href={`/api/reportes/excel?${parametros.toString()}`}
          className="foco-anillo inline-flex min-h-11 items-center rounded-lg bg-marca-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-marca-700"
        >
          Exportar a Excel
        </a>
      </div>

      <Tarjeta>
        {/* Una sola fila desde xl, con los botones al final: en dos filas el
            «Aplicar» quedaba bajo el primer campo, lejos de los demás. */}
        <form className="grid grid-cols-2 gap-3 lg:grid-cols-5 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
          {vista !== "solicitudes" && <input type="hidden" name="vista" value={vista} />}
          <Campo etiqueta="Desde" htmlFor="desde">
            <Entrada id="desde" type="date" name="desde" defaultValue={filtros.desde ?? ""} />
          </Campo>
          <Campo etiqueta="Hasta" htmlFor="hasta">
            <Entrada id="hasta" type="date" name="hasta" defaultValue={filtros.hasta ?? ""} />
          </Campo>
          <Campo etiqueta="Brigada" htmlFor="brigadaId">
            <Seleccion
              id="brigadaId"
              name="brigadaId"
              defaultValue={filtros.brigadaId ?? ""}
            >
              <option value="">Todas</option>
              {brigadas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Estado" htmlFor="estadoFiltro">
            <Seleccion
              id="estadoFiltro"
              name="estado"
              defaultValue={filtros.estado ?? ""}
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </option>
              ))}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Categoría" htmlFor="categoria">
            <Seleccion
              id="categoria"
              name="categoria"
              defaultValue={filtros.categoria ?? ""}
            >
              <option value="">Todas</option>
              <option value="EPP">EPP</option>
              <option value="EQUIPAMIENTO">Equipamiento</option>
            </Seleccion>
          </Campo>

          <div className="col-span-2 flex gap-2 lg:col-span-5 xl:col-span-1">
            <Boton type="submit">Aplicar filtros</Boton>
            <Link
              href="/reportes"
              className="foco-anillo inline-flex min-h-11 items-center rounded-lg border border-borde-fuerte bg-panel px-4 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-panel-suave"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </Tarjeta>

      {/* Lo primero que se busca en un reporte es el total: antes había que
          contar filas, y préstamos y traslados quedaban debajo de doscientas
          solicitudes. */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {resumen.map((r) => (
          <div key={r.texto} className="rounded-2xl border border-borde bg-panel p-3 sm:p-4">
            <dt className="text-sm text-tinta-suave">{r.texto}</dt>
            <dd className="dato-grande mt-1 text-tinta">{r.valor}</dd>
            {r.nota && <dd className="mt-0.5 text-xs text-tinta-tenue">{r.nota}</dd>}
          </div>
        ))}
      </dl>

      <nav aria-label="Secciones del reporte" className="flex gap-1 overflow-x-auto border-b border-borde">
        {pestanas.map((t) => {
          const activa = t.id === vista;
          return (
            <Link
              key={t.id}
              href={hrefVista(t.id)}
              aria-current={activa ? "page" : undefined}
              className={`foco-anillo -mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors duration-150 ${
                activa
                  ? "border-marca-600 text-tinta"
                  : "border-transparent text-tinta-suave hover:text-tinta"
              }`}
            >
              {t.texto}
              <span className="rounded-full bg-lienzo px-2 py-0.5 text-xs tabular-nums text-tinta-suave">
                {t.cuenta}
              </span>
            </Link>
          );
        })}
      </nav>

      {vista === "solicitudes" && (solicitudes.length === 0 ? (
        <Vacio mensaje="No hay solicitudes en el rango seleccionado." />
      ) : (
        <Tabla
          encabezados={[
            "Folio",
            "Solicitante",
            "Brigada",
            "Cargo",
            "Tipo",
            "Ítems",
            "Creada",
            "Estado",
          ]}
          anchoMinimo="48rem"
        >
          {solicitudes.map((s) => (
            <Fila key={s.id}>
              <Celda principal etiqueta="Folio" mono>
                <Link
                  href={`/solicitudes/${s.id}`}
                  className="foco-anillo inline-flex min-h-6 items-center rounded text-tinta-suave underline underline-offset-2"
                >
                  {formatearFolio(s.folio)}
                </Link>
              </Celda>
              <Celda etiqueta="Solicitante">{s.solicitante.nombre}</Celda>
              <Celda etiqueta="Brigada" tenue>{s.brigada?.nombre ?? "—"}</Celda>
              <Celda etiqueta="Cargo" tenue>{s.solicitante.cargo?.nombre ?? "—"}</Celda>
              <Celda etiqueta="Tipo" tenue>{s.tipo === "REEMPLAZO" ? "Reemplazo" : "Nuevo"}</Celda>
              <Celda etiqueta="Ítems" mono>{s._count.items}</Celda>
              <Celda etiqueta="Creada" tenue>{formatearFecha(s.creadaEn)}</Celda>
              <Celda etiqueta="Estado">
                <EstadoBadge estado={s.estado} />
              </Celda>
            </Fila>
          ))}
        </Tabla>
      ))}

      {vista === "solicitudes" && (
        <Paginacion
          paginaActual={pagina}
          totalPaginas={totalPaginas}
          href={(p) => hrefVista("solicitudes", p)}
        />
      )}

      {vista === "prestamos" && (
      <Seccion titulo={`Préstamos (${prestamos.length})`} plano>
        {prestamos.length === 0 ? (
          <div className="p-4">
            <Vacio mensaje="No hay préstamos en el rango seleccionado." />
          </div>
        ) : (
          <Tabla
            encabezados={[
              "Ítem",
              "Código",
              { texto: "Cantidad", alineado: "der" },
              "Prestado a",
              "Estado",
              "Registró",
              "Salida",
              "Devuelto",
            ]}
            anchoMinimo="52rem"
          >
            {prestamos.map((l) => (
              <Fila key={l.id}>
                <Celda principal etiqueta="Ítem">{l.item.nombre}</Celda>
                <Celda etiqueta="Código" mono tenue>
                  {l.item.codigo}
                </Celda>
                <Celda etiqueta="Cantidad" derecha mono>
                  {l.cantidad} {l.item.unidad}
                </Celda>
                <Celda etiqueta="Prestado a">{l.prestamo.persona}</Celda>
                <Celda etiqueta="Estado">
                  <Insignia
                    clases={
                      l.estadoDevolucion === "DANADO" || l.estadoDevolucion === "PERDIDO"
                        ? "bg-fallo-fondo text-fallo ring-fallo-borde"
                        : l.devueltoEn
                          ? "bg-exito-fondo text-exito ring-exito-borde"
                          : "bg-espera-fondo text-espera ring-espera-borde"
                    }
                  >
                    {l.estadoDevolucion === "DANADO"
                      ? "Devuelto dañado"
                      : l.estadoDevolucion === "PERDIDO"
                        ? "No devuelto"
                        : l.devueltoEn
                          ? "Devuelto"
                          : "En préstamo"}
                  </Insignia>
                </Celda>
                <Celda etiqueta="Registró" tenue>{l.prestamo.prestadoPor.nombre}</Celda>
                <Celda etiqueta="Salida" tenue>{formatearFecha(l.prestamo.prestadoEn)}</Celda>
                <Celda etiqueta="Devuelto" tenue>{l.devueltoEn ? formatearFecha(l.devueltoEn) : "—"}</Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Seccion>

      )}

      {vista === "traslados" && (
      <Seccion titulo={`Traslados / equipamiento asignado (${traslados.length})`} plano>
        {traslados.length === 0 ? (
          <div className="p-4">
            <Vacio mensaje="No hay traslados en el rango seleccionado." />
          </div>
        ) : (
          <Tabla
            encabezados={[
              "Ítem",
              "Código",
              { texto: "Cantidad", alineado: "der" },
              "Asignado a",
              "Brigada",
              "Cargo",
              "Asignó",
              "Fecha",
            ]}
            anchoMinimo="58rem"
          >
            {traslados.map((t) => (
              <Fila key={t.id}>
                <Celda principal etiqueta="Ítem">{t.item.nombre}</Celda>
                <Celda etiqueta="Código" mono tenue>
                  {t.item.codigo}
                </Celda>
                <Celda etiqueta="Cantidad" derecha mono>
                  {t.cantidad} {t.item.unidad}
                </Celda>
                <Celda etiqueta="Asignado a">
                  {duenoAsignacion(t.asignacion).nombre}
                  {/* Lo de la brigada no es de nadie en particular, y en una
                      lista de nombres propios eso hay que decirlo. */}
                  {duenoAsignacion(t.asignacion).esBrigada && (
                    <span className="block text-xs text-tinta-tenue">
                      equipamiento de la brigada
                    </span>
                  )}
                </Celda>
                <Celda etiqueta="Brigada" tenue>
                  {t.asignacion.brigada?.nombre ??
                    t.asignacion.usuario?.brigada?.nombre ??
                    "—"}
                </Celda>
                {/* Lo de la brigada no tiene cargo: no es de una persona. */}
                <Celda etiqueta="Cargo" tenue>
                  {t.asignacion.usuario?.cargo?.nombre ?? "—"}
                </Celda>
                <Celda etiqueta="Asignó" tenue>{t.asignacion.asignadoPor.nombre}</Celda>
                <Celda etiqueta="Fecha" tenue>{formatearFecha(t.asignacion.asignadoEn)}</Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Seccion>
      )}
    </div>
  );
}
