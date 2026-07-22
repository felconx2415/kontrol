"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

export default function SubirFoto({
  valor,
  onCambio,
}: {
  valor: string | null;
  onCambio: (url: string | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [subiendo, iniciarSubida] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function alSeleccionar(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);

    iniciarSubida(async () => {
      const datos = new FormData();
      datos.append("archivo", archivo);

      const respuesta = await fetch("/api/uploads", {
        method: "POST",
        body: datos,
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        setError(resultado.error ?? "No se pudo subir la imagen.");
        return;
      }
      onCambio(resultado.url);
    });
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-tinta-suave">
        Foto de evidencia (opcional)
      </span>

      {valor ? (
        <div className="flex items-center gap-3">
          <Image
            src={valor}
            alt="Evidencia del ítem a reemplazar"
            width={64}
            height={64}
            className="size-16 rounded-lg border border-borde object-cover"
          />
          <button
            type="button"
            onClick={() => {
              onCambio(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-sm text-fallo transition-colors duration-150 hover:underline"
          >
            Quitar foto
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={subiendo}
          onChange={(e) => alSeleccionar(e.target.files?.[0])}
          className="foco-anillo block w-full rounded-lg text-sm text-tinta-suave file:mr-3 file:rounded-lg file:border file:border-borde-fuerte file:bg-panel file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-panel-suave"
        />
      )}

      {subiendo && <p className="mt-1 text-xs text-tinta-tenue">Subiendo…</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-fallo">
          {error}
        </p>
      )}
    </div>
  );
}
