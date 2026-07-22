import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha } from "@/lib/vencimientos";
import { ETIQUETA_ESTADO, ROLES_GESTION } from "@/lib/solicitud-estado";
import EstadoBadge from "@/components/estado-badge";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, Vacio } from "@/components/ui/superficie";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { construirFiltro, type FiltrosReporte } from "@/lib/reportes";
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

  const [brigadas, solicitudes] = await Promise.all([
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
  ]);

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
    </div>
  );
}
