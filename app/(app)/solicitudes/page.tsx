import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha } from "@/lib/vencimientos";
import { ETIQUETA_ESTADO } from "@/lib/solicitud-estado";
import EstadoBadge from "@/components/estado-badge";
import Boton, { BotonEnlace } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, Vacio } from "@/components/ui/superficie";
import { ListaPanel } from "@/components/ui/tabla";
import Paginacion from "@/components/ui/paginacion";
import type { EstadoSolicitud, Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Solicitudes · Kontrol" };

const POR_PAGINA = 10;

const ESTADOS: EstadoSolicitud[] = [
  "PENDIENTE",
  "APROBADA",
  "EN_GESTION",
  "RECIBIDA",
  "ENTREGADA",
  "RECHAZADA",
  "CANCELADA",
];

export default async function ListaSolicitudes({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; mias?: string; q?: string; page?: string }>;
}) {
  const usuario = await requerirUsuario();
  const { estado, mias, q, page } = await searchParams;
  const pagina = Math.max(1, Number(page) || 1);

  const where: Prisma.SolicitudWhereInput = {};

  // El solicitante nunca ve solicitudes ajenas.
  if (usuario.rol === "SOLICITANTE" || mias === "1") {
    where.solicitanteId = usuario.id;
  }
  if (estado && ESTADOS.includes(estado as EstadoSolicitud)) {
    where.estado = estado as EstadoSolicitud;
  }
  if (q?.trim()) {
    const folio = Number(q.replace(/\D/g, ""));
    where.OR = [
      ...(Number.isFinite(folio) && folio > 0 ? [{ folio }] : []),
      { solicitante: { nombre: { contains: q.trim() } } },
    ];
  }

  const [total, solicitudes] = await Promise.all([
    db.solicitud.count({ where }),
    db.solicitud.findMany({
      where,
      orderBy: { creadaEn: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        solicitante: { select: { nombre: true } },
        brigada: { select: { nombre: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);
  const totalPaginas = Math.ceil(total / POR_PAGINA);

  // Preserva los filtros al cambiar de página.
  const hrefPagina = (p: number) => {
    const sp = new URLSearchParams();
    if (estado) sp.set("estado", estado);
    if (mias) sp.set("mias", mias);
    if (q) sp.set("q", q);
    sp.set("page", String(p));
    return `/solicitudes?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-pagina">Solicitudes</h1>
        <BotonEnlace href="/solicitudes/nueva">Nueva solicitud</BotonEnlace>
      </div>

      <Tarjeta>
        <form className="flex flex-wrap items-end gap-3">
          <Campo
            etiqueta="Buscar por folio o solicitante"
            htmlFor="q"
            className="min-w-0 flex-1"
          >
            <Entrada
              id="q"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Ej: 00012 o Juan Pérez"
            />
          </Campo>

          <Campo etiqueta="Estado" htmlFor="estado">
            <Seleccion id="estado" name="estado" defaultValue={estado ?? ""}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </option>
              ))}
            </Seleccion>
          </Campo>

          {usuario.rol !== "SOLICITANTE" && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-tinta-suave">
              <input
                type="checkbox"
                name="mias"
                value="1"
                defaultChecked={mias === "1"}
                className="foco-anillo size-5 cursor-pointer rounded border-borde-fuerte accent-marca-600"
              />
              Solo las mías
            </label>
          )}

          <Boton type="submit" variante="secundario" className="mb-0.5">
            Filtrar
          </Boton>
        </form>
      </Tarjeta>

      {solicitudes.length === 0 ? (
        <Vacio
          mensaje={
            estado || q || mias
              ? "Ninguna solicitud coincide con ese filtro. Prueba a limpiarlo o buscar por otro folio."
              : "Todavía no hay solicitudes registradas. La primera que crees aparecerá en esta lista."
          }
          accion={<BotonEnlace href="/solicitudes/nueva">Nueva solicitud</BotonEnlace>}
        />
      ) : (
        <ListaPanel>
          {solicitudes.map((s) => (
            <li key={s.id}>
              <Link
                href={`/solicitudes/${s.id}`}
                className="foco-anillo flex items-center justify-between gap-4 min-h-11 px-4 py-3 transition-colors duration-150 hover:bg-marca-50"
              >
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="font-mono text-xs tabular-nums text-tinta-tenue">
                    {formatearFolio(s.folio)}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {s.solicitante.nombre}
                  </span>
                  <span className="hidden truncate text-xs text-tinta-tenue sm:inline">
                    {s.tipo === "REEMPLAZO" ? "Reemplazo" : "Nuevo"} ·{" "}
                    {s._count.items} ítem{s._count.items === 1 ? "" : "s"}
                    {s.brigada ? ` · ${s.brigada.nombre}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-tinta-tenue md:inline">
                    {formatearFecha(s.creadaEn)}
                  </span>
                  <EstadoBadge estado={s.estado} />
                </div>
              </Link>
            </li>
          ))}
        </ListaPanel>
      )}

      <Paginacion
        paginaActual={pagina}
        totalPaginas={totalPaginas}
        href={hrefPagina}
      />
    </div>
  );
}
