/**
 * Búsqueda de la barra superior: folio o persona, desde cualquier pantalla.
 *
 * Es un GET a /solicitudes con `q`, el mismo filtro de esa lista: no hay un
 * buscador nuevo detrás, solo una puerta más corta. Lo que más se busca en
 * Kontrol es «¿en qué va el pedido de fulano?» o un folio que alguien dicta
 * por teléfono, y antes había que ir primero a Solicitudes.
 *
 * El campo va a 16px en móvil por el zoom de iOS (ver `CONTROL` en campo.tsx),
 * aunque en la práctica solo se muestra desde md.
 */
export default function BuscadorGlobal() {
  return (
    <form action="/solicitudes" role="search" className="relative w-full max-w-md">
      <label htmlFor="buscar-global" className="sr-only">
        Buscar solicitud por folio o persona
      </label>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-tinta-tenue"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        id="buscar-global"
        type="search"
        name="q"
        placeholder="Buscar folio o persona…"
        className="foco-anillo min-h-11 w-full rounded-xl border border-borde bg-panel pl-10 pr-3 text-base text-tinta transition-colors duration-150 placeholder:text-tinta-tenue hover:border-borde-fuerte sm:text-sm"
      />
    </form>
  );
}
