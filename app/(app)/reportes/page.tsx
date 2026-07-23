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
import { Seccion } from "@/components/ui/superficie";
import {
  construirFiltro,
  construirRangoFechas,
  type FiltrosReporte,
} from "@/lib/reportes";
import type { EstadoSolicitud } from "@/generated/prisma/enums";

export const metadata = { title: "Reportes · Kontrol" };

const ESTADOS: EstadoSolicitud[] = [
  "PENDIENTE",
  "APROBADA",
  "EN_GESTION",
  "RECIBIDA",
  "ENTREGADA",
  "RECHAZADA",
  "CANCELADA",
];

export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<FiltrosReporte>;
}) {
  await requerirRol(...ROLES_GESTION);
  const filtros = await searchParams;

  // El rango de fechas se aplica también a la bodega (préstamos por prestadoEn,
  // traslados por asignadoEn). Los filtros de estado/categoría son propios de
  // las solicitudes; brigada sí acota los traslados por la brigada del usuario.
  const rango = construirRangoFechas(filtros);

  const [brigadas, solicitudes, prestamos, traslados] = await Promise.all([
    db.brigada.findMany({ orderBy: { nombre: "asc" } }),
    db.solicitud.findMany({
      where: construirFiltro(filtros),
      orderBy: { creadaEn: "desc" },
      take: 200,
      include: {
        solicitante: { select: { nombre: true } },
        brigada: { select: { nombre: true } },
        _count: { select: { items: true } },
      },
    }),
    db.prestamo.findMany({
      where: rango ? { prestadoEn: rango } : {},
      orderBy: { prestadoEn: "desc" },
      take: 200,
      include: {
        item: { select: { codigo: true, nombre: true, unidad: true } },
        prestadoPor: { select: { nombre: true } },
      },
    }),
    db.asignacionBodega.findMany({
      where: {
        ...(rango ? { asignadoEn: rango } : {}),
        ...(filtros.brigadaId ? { usuario: { brigadaId: filtros.brigadaId } } : {}),
      },
      orderBy: { asignadoEn: "desc" },
      take: 200,
      include: {
        item: { select: { codigo: true, nombre: true, unidad: true } },
        usuario: { select: { nombre: true, brigada: { select: { nombre: true } } } },
        asignadoPor: { select: { nombre: true } },
      },
    }),
  ]);

  const prestamosActivos = prestamos.filter((p) => p.estado === "ACTIVO").length;

  const parametros = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => Boolean(v)) as [string, string][],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Reportes</h1>
          <p className="text-sm text-tinta-suave">
            {solicitudes.length} solicitud{solicitudes.length === 1 ? "" : "es"}{" "}
            {solicitudes.length === 200 ? "(máximo mostrado)" : ""}
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
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
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

      {solicitudes.length === 0 ? (
        <Vacio mensaje="No hay solicitudes en el rango seleccionado." />
      ) : (
        <Tabla
          encabezados={[
            "Folio",
            "Solicitante",
            "Brigada",
            "Tipo",
            "Ítems",
            "Creada",
            "Estado",
          ]}
        >
          {solicitudes.map((s) => (
            <Fila key={s.id}>
              <Celda mono>
                <Link
                  href={`/solicitudes/${s.id}`}
                  className="foco-anillo inline-flex min-h-6 items-center rounded text-tinta-suave underline underline-offset-2"
                >
                  {formatearFolio(s.folio)}
                </Link>
              </Celda>
              <Celda>{s.solicitante.nombre}</Celda>
              <Celda tenue>{s.brigada?.nombre ?? "—"}</Celda>
              <Celda tenue>{s.tipo === "REEMPLAZO" ? "Reemplazo" : "Nuevo"}</Celda>
              <Celda mono>{s._count.items}</Celda>
              <Celda tenue>{formatearFecha(s.creadaEn)}</Celda>
              <Celda>
                <EstadoBadge estado={s.estado} />
              </Celda>
            </Fila>
          ))}
        </Tabla>
      )}

      <div className="pt-2">
        <h2 className="titulo-pagina text-lg">Bodega local</h2>
        <p className="text-sm text-tinta-suave">
          Material fuera de la bodega en el período: {prestamosActivos} préstamo
          {prestamosActivos === 1 ? "" : "s"} activo
          {prestamosActivos === 1 ? "" : "s"} · {traslados.length} traslado
          {traslados.length === 1 ? "" : "s"}.
        </p>
      </div>

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
            {prestamos.map((p) => (
              <Fila key={p.id}>
                <Celda>{p.item.nombre}</Celda>
                <Celda mono tenue>
                  {p.item.codigo}
                </Celda>
                <Celda derecha mono>
                  {p.cantidad} {p.item.unidad}
                </Celda>
                <Celda>{p.persona}</Celda>
                <Celda>
                  <Insignia
                    clases={
                      p.estado === "ACTIVO"
                        ? "bg-espera-fondo text-espera ring-espera-borde"
                        : "bg-exito-fondo text-exito ring-exito-borde"
                    }
                  >
                    {p.estado === "ACTIVO" ? "Activo" : "Devuelto"}
                  </Insignia>
                </Celda>
                <Celda tenue>{p.prestadoPor.nombre}</Celda>
                <Celda tenue>{formatearFecha(p.prestadoEn)}</Celda>
                <Celda tenue>{p.devueltoEn ? formatearFecha(p.devueltoEn) : "—"}</Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Seccion>

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
              "Asignó",
              "Fecha",
            ]}
            anchoMinimo="52rem"
          >
            {traslados.map((t) => (
              <Fila key={t.id}>
                <Celda>{t.item.nombre}</Celda>
                <Celda mono tenue>
                  {t.item.codigo}
                </Celda>
                <Celda derecha mono>
                  {t.cantidad} {t.item.unidad}
                </Celda>
                <Celda>{t.usuario.nombre}</Celda>
                <Celda tenue>{t.usuario.brigada?.nombre ?? "—"}</Celda>
                <Celda tenue>{t.asignadoPor.nombre}</Celda>
                <Celda tenue>{formatearFecha(t.asignadoEn)}</Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Seccion>
    </div>
  );
}
