import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha } from "@/lib/vencimientos";
import { construirBandeja } from "@/lib/bandeja";
import { MENSAJE_SIN_EMPRESA, sinEmpresa } from "@/lib/alcance";
import {
  embudoEtapas,
  kpis,
  proximosCambios,
  vencimientosPorMes,
} from "@/lib/metricas";
import { BotonEnlace } from "@/components/ui/boton";
import { Aviso } from "@/components/ui/superficie";
import Insignia from "@/components/ui/insignia";
import ProgresoSolicitud from "@/components/progreso-solicitud";
import TarjetaKpi from "@/components/graficos/tarjeta-kpi";
import BarrasHorizontales from "@/components/graficos/barras-horizontales";
import ColumnasVencimiento from "@/components/graficos/columnas-vencimiento";

export const metadata = { title: "Escritorio · Kontrol" };

/**
 * «Buenos días, Camila»: la hora es la de Chile, no la del servidor, que en el
 * contenedor podría estar en UTC. El saludo es lo que hace que el escritorio
 * se sienta de quien lo abre y no un tablero genérico.
 */
function saludo(nombre: string) {
  const hora = Number(
    new Intl.DateTimeFormat("es-CL", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Santiago",
    }).format(new Date()),
  );
  const momento = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  return `${momento}, ${nombre.trim().split(/\s+/)[0]}`;
}

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
      className={`rounded-2xl border border-borde bg-panel ${className}`}
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
    kpis(usuario.id, usuario.rol, usuario.alcance),
    esSolicitante ? Promise.resolve([]) : embudoEtapas(usuario.alcance),
    esSolicitante ? Promise.resolve([]) : vencimientosPorMes(usuario.alcance),
    esSolicitante ? Promise.resolve([]) : proximosCambios(usuario.alcance),
    construirBandeja(usuario.id, usuario.rol, usuario.alcance),
  ]);

  // Los pedidos pendientes de acción, sin "mis solicitudes" (que no es cola).
  const pendientes = grupos.filter((g) => g.clave !== "mias");
  const mias = grupos.find((g) => g.clave === "mias");

  // El solicitante solo tiene «mis solicitudes»: partir la pantalla lo dejaría
  // en una columna angosta a la derecha con la izquierda vacía.
  const dosZonas = !esSolicitante;

  return (
    // `data-pagina`: el título es un saludo y cambia con la hora y la persona,
    // así que las pruebas reconocen el escritorio por esto y no por el texto.
    <div className="space-y-5" data-pagina="escritorio">
      {error === "sin-permiso" && (
        <Aviso tono="error">No tienes permiso para acceder a esa sección.</Aviso>
      )}

      {/* Una cuenta sin empresa no ve nada de nadie y lo que aparece en
          pantalla son ceros. Sin este aviso parecería que el sistema está
          vacío, en vez de que falta configurarla. */}
      {sinEmpresa(usuario.alcance) && (
        <Aviso tono="error">{MENSAJE_SIN_EMPRESA}</Aviso>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">{saludo(usuario.nombre)}</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {esSolicitante
              ? "Así van tus pedidos de EPP y equipamiento."
              : "Esto es lo que espera tu gestión hoy: pedidos por etapa y cambios de EPP por vencimiento."}
          </p>
        </div>
        <BotonEnlace href="/solicitudes/nueva">Nueva solicitud</BotonEnlace>
      </div>

      {/* Dos columnas desde el teléfono: una cifra no necesita el ancho
          completo, y en una sola columna las cuatro tarjetas llenaban la
          primera pantalla antes de llegar a nada que hacer. */}
      <div
        className={`grid gap-3 ${
          tarjetas.length === 1
            ? "sm:grid-cols-2"
            : tarjetas.length >= 4
              ? "grid-cols-2 lg:grid-cols-4"
              : "grid-cols-2"
        }`}
      >
        {tarjetas.map((k) => (
          <TarjetaKpi key={k.clave} kpi={k} />
        ))}
      </div>

      {/* En pantalla ancha, dos zonas: a la izquierda lo que hay que hacer
          (las colas y los vencimientos con nombre y fecha) y a la derecha lo
          que se consulta de un vistazo (mis pedidos y los dos gráficos). En
          una sola columna eran más de tres mil píxeles de alto en un monitor
          que tenía la mitad del ancho vacío.

          La colocación es explícita en la rejilla para que en el teléfono el
          orden siga siendo colas → mis solicitudes → gráficos → vencimientos:
          la columna lateral va entre las dos piezas de la izquierda en el
          código, pero en escritorio ocupa las dos filas a la derecha. */}
      <div
        className={
          dosZonas
            ? "grid gap-5 xl:grid-cols-3 xl:grid-rows-[auto_1fr] xl:items-start"
            : "space-y-5"
        }
      >
        {/* Desde 2xl las colas se reparten en dos columnas (como un tablero):
            una fila de cola mide poco, y a todo el ancho de la zona izquierda
            el verbo quedaba a seiscientos píxeles del nombre. */}
        <div
          className={`space-y-5 ${
            dosZonas
              ? "xl:col-span-2 xl:row-start-1 2xl:columns-2 2xl:gap-5 2xl:space-y-0 2xl:[&>*]:mb-5 2xl:[&>*]:break-inside-avoid"
              : ""
          }`}
        >
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
                      {/* En el teléfono el detalle baja a una segunda línea en vez
                          de esconderse: tipo, ítems y brigada son lo que distingue
                          quince pedidos de la misma cuadrilla. */}
                      <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                        {/* En una sola fila se recorta primero el detalle y no
                            el nombre: el nombre es lo que se busca con la vista. */}
                        <span className="flex min-w-0 items-baseline gap-3 sm:shrink-0">
                          <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-tinta-tenue">
                            {formatearFolio(s.folio)}
                          </span>
                          <span className="truncate text-sm font-medium">
                            {s.solicitanteNombre}
                          </span>
                        </span>
                        <span className="truncate text-xs text-tinta-tenue">
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
        </div>

        <aside
          className={`space-y-5 ${dosZonas ? "xl:col-start-3 xl:row-span-2 xl:row-start-1" : ""}`}
        >
          {mias && (
            <Panel titulo="Mis solicitudes en curso" descripcion={mias.indicacion}>
              {/* A diferencia de las colas de gestión, aquí no hay nada que hacer:
                  lo único que se quiere saber es en qué paso va cada pedido, así
                  que la fila lleva la barra de progreso en vez de un verbo. */}
              <ul className="-mx-4 -my-4 divide-y divide-borde">
                {mias.solicitudes.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/solicitudes/${s.id}`}
                      className="foco-anillo group block px-4 py-3 transition-colors duration-150 hover:bg-marca-50"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="flex min-w-0 items-baseline gap-3">
                          <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-tinta-tenue">
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
                      </div>

                      <div className="mt-2 max-w-md">
                        <ProgresoSolicitud estado={s.estado} />
                      </div>

                      {s.creadaPorNombre && (
                        <p className="mt-1 text-xs text-tinta-tenue">
                          Registrada por {s.creadaPorNombre} a tu nombre.
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {!esSolicitante && (
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1">
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
        </aside>

        <div className={`space-y-5 ${dosZonas ? "xl:col-span-2 xl:row-start-2" : ""}`}>
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
                          <td data-label="Artículo" className="celda-principal px-4 py-2.5">
                            <span className="font-medium">{c.articulo}</span>
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
                              <Insignia clases="bg-proceso-fondo text-proceso ring-proceso-borde">
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
        </div>
      </div>
    </div>
  );
}
