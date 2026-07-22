import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha } from "@/lib/vencimientos";
import { construirBandeja } from "@/lib/bandeja";
import {
  embudoEtapas,
  kpis,
  proximosCambios,
  vencimientosPorMes,
} from "@/lib/metricas";
import { BotonEnlace } from "@/components/ui/boton";
import { Aviso } from "@/components/ui/superficie";
import Insignia from "@/components/ui/insignia";
import TarjetaKpi from "@/components/graficos/tarjeta-kpi";
import BarrasHorizontales from "@/components/graficos/barras-horizontales";
import ColumnasVencimiento from "@/components/graficos/columnas-vencimiento";

export const metadata = { title: "Escritorio · Kontrol" };

function Panel({
  titulo,
  descripcion,
  children,
  className = "",
  id,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-borde bg-panel ${className}`}
    >
      <header className="border-b border-borde px-4 py-3">
        <h2 className="titulo-seccion">{titulo}</h2>
        {descripcion && (
          <p className="mt-0.5 text-xs text-tinta-tenue">{descripcion}</p>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function Escritorio({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const usuario = await requerirUsuario();
  const { error } = await searchParams;
  const esSolicitante = usuario.rol === "SOLICITANTE";

  const [tarjetas, etapas, meses, cambios, grupos] = await Promise.all([
    kpis(usuario.id, usuario.rol),
    esSolicitante ? Promise.resolve([]) : embudoEtapas(),
    esSolicitante ? Promise.resolve([]) : vencimientosPorMes(),
    esSolicitante ? Promise.resolve([]) : proximosCambios(),
    construirBandeja(usuario.id, usuario.rol),
  ]);

  // Los pedidos pendientes de acción, sin "mis solicitudes" (que no es cola).
  const pendientes = grupos.filter((g) => g.clave !== "mias");
  const mias = grupos.find((g) => g.clave === "mias");

  return (
    <div className="space-y-5">
      {error === "sin-permiso" && (
        <Aviso tono="error">No tienes permiso para acceder a esa sección.</Aviso>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">Escritorio</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Estado de los pedidos y próximos cambios de EPP por vencimiento.
          </p>
        </div>
        <BotonEnlace href="/solicitudes/nueva">Nueva solicitud</BotonEnlace>
      </div>

      <div
        className={`grid gap-3 ${
          tarjetas.length >= 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-2"
        }`}
      >
        {tarjetas.map((k) => (
          <TarjetaKpi key={k.clave} kpi={k} />
        ))}
      </div>

      {!esSolicitante && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            titulo="Pedidos por etapa"
            descripcion="Solicitudes activas y cuánto lleva detenida la más antigua."
          >
            <BarrasHorizontales
              totalEtiqueta="Total en curso"
              datos={etapas.map((e) => ({
                clave: e.estado,
                etiqueta: e.etiqueta,
                valor: e.valor,
                nota:
                  e.valor > 0 && e.esperaMaxima !== null
                    ? e.esperaMaxima === 0
                      ? "hoy"
                      : `${e.esperaMaxima} d`
                    : null,
                href: `/solicitudes?estado=${e.estado}`,
                destacar: e.esperaMaxima !== null && e.esperaMaxima >= 7,
              }))}
            />
          </Panel>

          <Panel
            titulo="Cambios de EPP previstos"
            descripcion="Ítems que llegan a su fecha de vencimiento, por mes."
          >
            <ColumnasVencimiento datos={meses} />
          </Panel>
        </div>
      )}

      {!esSolicitante && (
        <Panel
          id="cambios"
          titulo="Próximos cambios por vencimiento"
          descripcion="Ordenados por fecha: lo más urgente primero."
          className="scroll-mt-4"
        >
          {cambios.length === 0 ? (
            <p className="py-6 text-center text-sm text-tinta-tenue">
              Ningún EPP vence en los próximos 30 días.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="tabla-apilable w-full min-w-[38rem] text-sm">
                <thead className="border-b border-borde text-left text-xs text-tinta-tenue">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Artículo
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Asignado a
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Vence
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {cambios.map((c) => (
                    <tr key={c.id} className="hover:bg-panel-suave">
                      <td data-label="Artículo" className="px-4 py-2.5">
                        <span className="font-medium">{c.articulo}</span>
                        {c.talla && (
                          <span className="text-tinta-tenue"> · talla {c.talla}</span>
                        )}
                      </td>
                      <td data-label="Asignado a" className="px-4 py-2.5">
                        <Link
                          href={`/historial/${c.personaId}`}
                          className="foco-anillo inline-flex min-h-6 items-center rounded underline underline-offset-2"
                        >
                          {c.persona}
                        </Link>
                        {c.brigada && (
                          <span className="text-tinta-tenue"> · {c.brigada}</span>
                        )}
                      </td>
                      <td
                        data-label="Vence"
                        className="whitespace-nowrap px-4 py-2.5 tabular-nums"
                      >
                        {formatearFecha(c.venceEn)}
                        <span className="text-tinta-tenue">
                          {" "}
                          ·{" "}
                          {c.dias < 0
                            ? `hace ${Math.abs(c.dias)} d`
                            : `en ${c.dias} d`}
                        </span>
                      </td>
                      <td data-label="Estado" className="px-4 py-2.5">
                        {c.reemplazoEnCurso ? (
                          <Insignia clases="bg-marca-50 text-marca-700 ring-marca-200">
                            Reemplazo en curso
                          </Insignia>
                        ) : c.dias < 0 ? (
                          <Insignia clases="bg-fallo-fondo text-fallo ring-fallo-borde">
                            Vencido
                          </Insignia>
                        ) : (
                          <Insignia clases="bg-espera-fondo text-espera ring-espera-borde">
                            Por vencer
                          </Insignia>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {pendientes.map((grupo) => (
        <Panel
          key={grupo.clave}
          titulo={`${grupo.titulo} · ${grupo.solicitudes.length}`}
          descripcion={grupo.indicacion}
        >
          <ul className="-mx-4 -my-4 divide-y divide-borde">
            {grupo.solicitudes.map((s) => (
              <li key={s.id}>
                <Link
                  href={
                    grupo.clave === "entregar"
                      ? `/solicitudes/${s.id}/entrega`
                      : `/solicitudes/${s.id}`
                  }
                  className="foco-anillo group flex min-h-11 items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-marca-50"
                >
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span className="font-mono text-xs tabular-nums text-tinta-tenue">
                      {formatearFolio(s.folio)}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {s.solicitanteNombre}
                    </span>
                    <span className="hidden truncate text-xs text-tinta-tenue sm:inline">
                      {s.tipo === "REEMPLAZO" ? "Reemplazo" : "Nuevo"} ·{" "}
                      {s.totalItems} ítem{s.totalItems === 1 ? "" : "s"}
                      {s.brigadaNombre ? ` · ${s.brigadaNombre}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-marca-600 group-hover:underline">
                    {grupo.accion} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      {mias && (
        <Panel titulo="Mis solicitudes en curso" descripcion={mias.indicacion}>
          <ul className="-mx-4 -my-4 divide-y divide-borde">
            {mias.solicitudes.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/solicitudes/${s.id}`}
                  className="foco-anillo group flex min-h-11 items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-marca-50"
                >
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span className="font-mono text-xs tabular-nums text-tinta-tenue">
                      {formatearFolio(s.folio)}
                    </span>
                    <span className="truncate text-sm">
                      {s.tipo === "REEMPLAZO" ? "Reemplazo" : "Nuevo"} ·{" "}
                      {s.totalItems} ítem{s.totalItems === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-marca-600 group-hover:underline">
                    Ver →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
