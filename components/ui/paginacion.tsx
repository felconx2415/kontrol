import Link from "next/link";

/**
 * Paginación por URL (`?page=N`), server-friendly: cada número es un enlace.
 * Se oculta sola cuando hay una sola página. `href` construye la URL de cada
 * página preservando los demás parámetros que le pase la vista.
 */
function paginasVisibles(actual: number, total: number): (number | "…")[] {
  const salida: (number | "…")[] = [];
  for (let p = 1; p <= total; p++) {
    // Primera, última y una ventana de ±1 alrededor de la actual.
    if (p === 1 || p === total || Math.abs(p - actual) <= 1) {
      salida.push(p);
    } else if (salida[salida.length - 1] !== "…") {
      salida.push("…");
    }
  }
  return salida;
}

function Chevron({ rotar = false }: { rotar?: boolean }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      className={rotar ? "rotate-180" : undefined}
      aria-hidden="true"
    >
      <path
        d="M22.499 12.85a.9.9 0 0 1 .57.205l.067.06a.9.9 0 0 1 .06 1.206l-.06.066-5.585 5.586-.028.027.028.027 5.585 5.587a.9.9 0 0 1 .06 1.207l-.06.066a.9.9 0 0 1-1.207.06l-.066-.06-6.25-6.25a1 1 0 0 1-.158-.212l-.038-.08a.9.9 0 0 1-.03-.606l.03-.083a1 1 0 0 1 .137-.226l.06-.066 6.25-6.25a.9.9 0 0 1 .635-.263Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth=".078"
      />
    </svg>
  );
}

const FLECHA =
  "foco-anillo inline-flex size-10 items-center justify-center rounded-full transition-colors duration-150";

export default function Paginacion({
  paginaActual,
  totalPaginas,
  href,
}: {
  paginaActual: number;
  totalPaginas: number;
  href: (pagina: number) => string;
}) {
  if (totalPaginas <= 1) return null;

  const paginas = paginasVisibles(paginaActual, totalPaginas);
  const enPrimera = paginaActual <= 1;
  const enUltima = paginaActual >= totalPaginas;

  return (
    <nav
      aria-label="Paginación"
      className="mt-4 flex items-center justify-center gap-3 text-tinta-suave"
    >
      {enPrimera ? (
        <span className={`${FLECHA} opacity-40`} aria-hidden="true">
          <Chevron />
        </span>
      ) : (
        <Link
          href={href(paginaActual - 1)}
          aria-label="Página anterior"
          className={`${FLECHA} bg-panel-suave hover:bg-lienzo hover:text-tinta`}
        >
          <Chevron />
        </Link>
      )}

      <div className="flex items-center gap-1 text-sm font-medium">
        {paginas.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-tinta-tenue" aria-hidden="true">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              aria-current={p === paginaActual ? "page" : undefined}
              className={`flex size-10 items-center justify-center rounded-full transition-colors duration-150 ${
                p === paginaActual
                  ? "border border-marca-200 text-marca-700"
                  : "text-tinta-suave hover:bg-panel-suave hover:text-tinta"
              }`}
            >
              {p}
            </Link>
          ),
        )}
      </div>

      {enUltima ? (
        <span className={`${FLECHA} opacity-40`} aria-hidden="true">
          <Chevron rotar />
        </span>
      ) : (
        <Link
          href={href(paginaActual + 1)}
          aria-label="Página siguiente"
          className={`${FLECHA} bg-panel-suave hover:bg-lienzo hover:text-tinta`}
        >
          <Chevron rotar />
        </Link>
      )}
    </nav>
  );
}
