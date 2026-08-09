import { requerirUsuario } from "@/lib/auth";
import { listarNotificaciones } from "@/lib/notificaciones";
import { haceCuanto } from "@/lib/tiempo-relativo";
import { formatearFechaHora } from "@/lib/vencimientos";
import { abrirNotificacion, marcarTodo } from "@/actions/notificaciones";
import Boton from "@/components/ui/boton";
import { Vacio } from "@/components/ui/superficie";

export const metadata = { title: "Notificaciones · Kontrol" };

export default async function PaginaNotificaciones() {
  const usuario = await requerirUsuario();

  const notificaciones = await listarNotificaciones(usuario.id);
  const sinLeer = notificaciones.filter((n) => n.leidaEn === null).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Notificaciones</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {sinLeer === 0
              ? "Estás al día."
              : `${sinLeer} sin leer de las últimas ${notificaciones.length}.`}
          </p>
        </div>

        {sinLeer > 0 && (
          <form action={marcarTodo}>
            <Boton
              type="submit"
              variante="secundario"
              textoPendiente="Marcando…"
            >
              Marcar todas como leídas
            </Boton>
          </form>
        )}
      </div>

      {notificaciones.length === 0 ? (
        <Vacio mensaje="Todavía no tienes avisos. Aquí aparecerá lo que pase con tus solicitudes y lo que te toque revisar." />
      ) : (
        <ul className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-panel">
          {notificaciones.map((n) => {
            const leida = n.leidaEn !== null;

            return (
              <li key={n.id}>
                {/* Un formulario por fila: abrirla la marca leída y lleva a
                    donde apunta, en un solo gesto. */}
                <form action={abrirNotificacion}>
                  <input type="hidden" name="notificacionId" value={n.id} />
                  <input
                    type="hidden"
                    name="url"
                    value={n.url ?? "/notificaciones"}
                  />
                  <button
                    type="submit"
                    className={`foco-anillo block w-full cursor-pointer px-4 py-3.5 text-left transition-colors duration-150 hover:bg-marca-50 ${
                      leida ? "" : "bg-marca-50/60"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      {!leida && (
                        <span
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-marca-600"
                          aria-hidden="true"
                        />
                      )}
                      <p
                        className={`min-w-0 flex-1 ${
                          leida ? "text-tinta-suave" : "font-semibold"
                        }`}
                      >
                        {n.titulo}
                      </p>
                      <time
                        dateTime={n.creadaEn.toISOString()}
                        title={formatearFechaHora(n.creadaEn)}
                        className="shrink-0 text-xs text-tinta-tenue"
                      >
                        {haceCuanto(n.creadaEn)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-tinta-suave">{n.cuerpo}</p>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
