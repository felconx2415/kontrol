/**
 * Esqueleto único para todo el grupo (app). Las páginas son dinámicas (leen la
 * sesión en cada request), así que sin esto un clic en la píldora no daba
 * ninguna señal hasta que el servidor respondía y el cambio se sentía como una
 * recarga. Es deliberadamente genérico —título, fila de tarjetas, panel con
 * filas— porque aparece unos cientos de milisegundos: imitar la silueta exacta
 * de cada página costaría un loading.tsx por ruta sin que nadie lo note.
 */
export default function CargandoApp() {
  return (
    <div aria-hidden="true" className="animate-pulse space-y-5">
      {/* Título y subtítulo, con las mismas alturas que titulo-pagina deja. */}
      <div className="space-y-2.5">
        <div className="h-7 w-48 rounded bg-borde" />
        <div className="h-4 w-72 max-w-full rounded bg-borde/60" />
      </div>

      {/* Fila de tarjetas al ancho, como los KPI del escritorio o los
          resúmenes de sección. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-borde bg-panel p-4"
          >
            <div className="h-3.5 w-24 rounded bg-borde/60" />
            <div className="h-8 w-16 rounded bg-borde" />
          </div>
        ))}
      </div>

      {/* Panel principal: encabezado y filas, la silueta de una tabla. */}
      <div className="rounded-xl border border-borde bg-panel">
        <div className="border-b border-borde px-4 py-3">
          <div className="h-4 w-36 rounded bg-borde" />
        </div>
        <div className="space-y-4 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 flex-1 rounded bg-borde/60" />
              <div className="hidden h-4 w-24 rounded bg-borde/60 sm:block" />
              <div className="h-5 w-20 rounded-full bg-borde/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
