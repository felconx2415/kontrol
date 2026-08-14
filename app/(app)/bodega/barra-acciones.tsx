"use client";

import { useState, type ReactNode } from "react";
import { BotonEnlace, clasesBoton } from "@/components/ui/boton";

type Panel = "item" | "catalogo" | "movimiento";

/**
 * Cabecera de acciones de la bodega: en vez de tener los tres formularios
 * siempre abiertos (que empujaban el inventario dos pantallas hacia abajo),
 * cada uno vive detrás de un botón y solo uno se despliega a la vez.
 */
export default function BarraAcciones({
  formularioItem,
  formularioCatalogo,
  formularioMovimiento,
  puedeAsignar,
}: {
  formularioItem: ReactNode;
  formularioCatalogo: ReactNode | null;
  formularioMovimiento: ReactNode | null;
  /** Hay algo con stock que entregar. Sin eso la página de asignar sale vacía. */
  puedeAsignar: boolean;
}) {
  const [abierto, setAbierto] = useState<Panel | null>(null);
  const alternar = (p: Panel) => setAbierto((a) => (a === p ? null : p));

  const boton = (p: Panel, texto: string) => (
    <button
      type="button"
      onClick={() => alternar(p)}
      aria-expanded={abierto === p}
      className={clasesBoton(abierto === p ? "primario" : "secundario", "sm")}
    >
      {texto}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {boton("item", "+ Agregar ítem")}
        {formularioCatalogo && boton("catalogo", "Desde el catálogo")}
        {formularioMovimiento && boton("movimiento", "Registrar movimiento")}

        {/* Entregar material a nombre de alguien no es administrar el
            inventario: va en primario, como su gemelo «Nuevo préstamo», para
            que no se lea como un cuarto formulario de los de al lado. Antes
            solo se llegaba por el menú «⋯» de un ítem, que tenía sentido
            cuando la entrega era de una cosa; ahora se parte por la persona. */}
        {puedeAsignar && (
          <BotonEnlace href="/bodega/asignar" tamano="sm">
            Asignar equipamiento
          </BotonEnlace>
        )}
      </div>

      {abierto === "item" && <div className="panel-expandible">{formularioItem}</div>}
      {abierto === "catalogo" && (
        <div className="panel-expandible">{formularioCatalogo}</div>
      )}
      {abierto === "movimiento" && (
        <div className="panel-expandible">{formularioMovimiento}</div>
      )}
    </div>
  );
}
