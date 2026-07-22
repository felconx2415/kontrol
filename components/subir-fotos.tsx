"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

/**
 * Subida de varias fotos. Cada archivo se sube a /api/uploads y el componente
 * mantiene el arreglo de rutas. Pensado para las fotos de daños al devolver un
 * préstamo, donde puede haber más de una.
 */
export default function SubirFotos({
  valor,
  onCambio,
  etiqueta = "Fotos de daños (opcional)",
}: {
  valor: string[];
  onCambio: (urls: string[]) => void;
  etiqueta?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [subiendo, iniciarSubida] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function alSeleccionar(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return;
    setError(null);
    const lista = Array.from(archivos);

    iniciarSubida(async () => {
      const nuevas: string[] = [];
      for (const archivo of lista) {
        const datos = new FormData();
        datos.append("archivo", archivo);
        const respuesta = await fetch("/api/uploads", { method: "POST", body: datos });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
          setError(resultado.error ?? "No se pudo subir una imagen.");
          continue;
        }
        nuevas.push(resultado.url);
      }
      if (nuevas.length > 0) onCambio([...valor, ...nuevas]);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-tinta-suave">
        {etiqueta}
      </span>

      {valor.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {valor.map((url) => (
            <li key={url} className="relative">
              <Image
                src={url}
                alt="Foto de daño"
                width={80}
                height={80}
                className="size-20 rounded-lg border border-borde object-cover"
              />
              <button
                type="button"
                aria-label="Quitar foto"
                onClick={() => onCambio(valor.filter((u) => u !== url))}
                className="foco-anillo absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-full border border-borde bg-panel text-fallo shadow-sm transition-colors duration-150 hover:bg-fallo-fondo"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="size-3.5"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        disabled={subiendo}
        onChange={(e) => alSeleccionar(e.target.files)}
        className="foco-anillo block w-full rounded-lg text-sm text-tinta-suave file:mr-3 file:rounded-lg file:border file:border-borde-fuerte file:bg-panel file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-panel-suave"
      />

      {subiendo && <p className="mt-1 text-xs text-tinta-tenue">Subiendo…</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-fallo">
          {error}
        </p>
      )}
    </div>
  );
}
