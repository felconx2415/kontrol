"use client";

import { useId, useMemo, useRef, useState } from "react";
import { CONTROL } from "@/components/ui/campo";

export type OpcionBuscador = {
  id: string;
  /** Texto principal (nombre del artículo). */
  principal: string;
  /** Texto secundario en tono tenue (código, fecha…). */
  secundario?: string;
  /** Cadena ya normalizada contra la que se busca. */
  buscable: string;
};

const LIMITE = 40;

/** Quita tildes y pasa a minúsculas para buscar sin importar acentos. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Buscador de artículos con filtrado en vivo. Reemplaza al <select> nativo, que
 * con 200+ artículos era inmanejable. Filtra por nombre o código (sin tildes,
 * por palabras), se maneja con teclado y agrega el ítem al elegirlo.
 */
export default function BuscadorArticulo({
  opciones,
  placeholder,
  onElegir,
  etiqueta,
}: {
  opciones: OpcionBuscador[];
  placeholder: string;
  onElegir: (id: string) => void;
  etiqueta: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const cerrarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idLista = useId();

  const consulta = normalizar(texto.trim());

  const resultados = useMemo(() => {
    const filtradas = consulta
      ? opciones.filter((o) =>
          consulta.split(/\s+/).every((t) => o.buscable.includes(t)),
        )
      : opciones;
    return { lista: filtradas.slice(0, LIMITE), total: filtradas.length };
  }, [opciones, consulta]);

  function elegir(id: string) {
    onElegir(id);
    setTexto("");
    setActivo(0);
    setAbierto(false);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setAbierto(true);
      return;
    }
    const n = resultados.lista.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => (n === 0 ? 0 : (a + 1) % n));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (n === 0 ? 0 : (a - 1 + n) % n));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resultados.lista[activo]) elegir(resultados.lista[activo].id);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-label={etiqueta}
        autoComplete="off"
        className={CONTROL}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => {
          // Retraso para que el clic sobre un resultado alcance a registrarse.
          cerrarTimeout.current = setTimeout(() => setAbierto(false), 120);
        }}
        onKeyDown={alTeclear}
      />

      {abierto && (
        <div
          id={idLista}
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-borde-fuerte bg-panel shadow-lg"
          onMouseDown={(e) => {
            // Evita que el input pierda foco (y se cierre) antes del clic.
            e.preventDefault();
            if (cerrarTimeout.current) clearTimeout(cerrarTimeout.current);
          }}
        >
          {resultados.lista.length === 0 ? (
            <p className="px-3 py-3 text-sm text-tinta-tenue">
              Sin resultados{texto.trim() ? ` para «${texto.trim()}»` : ""}.
            </p>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {resultados.lista.map((o, i) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activo}
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => elegir(o.id)}
                    className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition-colors duration-100 ${
                      i === activo ? "bg-marca-50 text-marca-800" : "text-tinta hover:bg-panel-suave"
                    }`}
                  >
                    <span className="min-w-0 flex-1 whitespace-normal break-words">
                      {o.principal}
                    </span>
                    {o.secundario && (
                      <span className="shrink-0 font-mono text-xs text-tinta-tenue">
                        {o.secundario}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {resultados.total > LIMITE && (
                <li className="px-3 py-2 text-xs text-tinta-tenue">
                  {resultados.total - LIMITE} más… afina la búsqueda.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
