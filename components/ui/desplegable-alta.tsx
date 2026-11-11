import type { ReactNode } from "react";

/**
 * Formulario de alta plegado tras un botón.
 *
 * En las páginas de Configuración la lista es lo que se consulta a diario y el
 * alta, lo ocasional; con el formulario abierto arriba, en el teléfono había
 * que bajar setecientos píxeles para llegar a la primera cuenta. Plegado
 * queda a un toque y la lista empieza donde empieza la pantalla.
 *
 * Es un `<details>` nativo y no estado de React: funciona sin JavaScript y,
 * como el formulario sigue montado al cerrarlo, no pierde lo escrito ni el
 * aviso de «creado» que deja la Server Action.
 *
 * `abierto` lo trae desplegado cuando la lista está vacía: ahí crear es lo
 * único que se puede hacer.
 */
export default function DesplegableAlta({
  texto,
  abierto = false,
  children,
}: {
  texto: string;
  abierto?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={abierto} className="group">
      <summary className="foco-anillo inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-borde-fuerte bg-panel px-4 py-2 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-panel-suave group-open:mb-3 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-base leading-none group-open:hidden">
          +
        </span>
        <span aria-hidden="true" className="hidden text-base leading-none group-open:inline">
          −
        </span>
        {texto}
      </summary>
      <div className="panel-expandible">{children}</div>
    </details>
  );
}
