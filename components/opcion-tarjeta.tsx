"use client";

/**
 * Una opción excluyente presentada como tarjeta pulsable.
 *
 * Radios en vez de un `<select>` cuando las opciones son pocas y con
 * consecuencias distintas: conviene verlas todas a la vez. El área pulsable es
 * la tarjeta entera, no el círculo, porque esto se usa en terreno y con
 * guantes.
 *
 * Nació en la entrega de una solicitud («¿quién recibe?») y la asignación de
 * bodega necesitaba exactamente lo mismo dos veces —a quién va y quién retira—,
 * así que vive aquí en vez de repetido en cada formulario.
 */
export default function OpcionTarjeta<T extends string>({
  valor,
  actual,
  onElegir,
  grupo,
  titulo,
  detalle,
  deshabilitado = false,
  detalleDeshabilitado,
}: {
  valor: T;
  actual: T;
  onElegir: (v: T) => void;
  /** Nombre del grupo de radios; distinto por cada juego de opciones. */
  grupo: string;
  titulo: string;
  detalle: string;
  deshabilitado?: boolean;
  /** Por qué no se puede elegir, cuando está deshabilitada. */
  detalleDeshabilitado?: string;
}) {
  const elegida = actual === valor;

  return (
    <label
      className={`flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors duration-150 ${
        deshabilitado
          ? "cursor-not-allowed border-borde opacity-60"
          : `cursor-pointer ${
              elegida
                ? "border-marca-600 bg-marca-50"
                : "border-borde hover:bg-panel-suave"
            }`
      }`}
    >
      <input
        type="radio"
        name={grupo}
        value={valor}
        checked={elegida}
        disabled={deshabilitado}
        onChange={() => onElegir(valor)}
        className="foco-anillo mt-0.5 size-5 shrink-0 cursor-pointer accent-marca-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-tinta">{titulo}</span>
        <span className="block text-xs text-tinta-suave">
          {deshabilitado ? (detalleDeshabilitado ?? detalle) : detalle}
        </span>
      </span>
    </label>
  );
}
