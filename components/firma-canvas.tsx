"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Canvas de firma con soporte para mouse y táctil. Expone el trazo como
 * data URL PNG a través de un input oculto para que viaje en el <form>.
 */
export default function FirmaCanvas({
  name,
  onCambio,
}: {
  name: string;
  onCambio?: (tieneFirma: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [valor, setValor] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Escalar al devicePixelRatio para que el trazo no salga pixelado.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  function posicion(evento: React.PointerEvent<HTMLCanvasElement>) {
    const rect = evento.currentTarget.getBoundingClientRect();
    return { x: evento.clientX - rect.left, y: evento.clientY - rect.top };
  }

  function iniciar(evento: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    dibujando.current = true;
    const { x, y } = posicion(evento);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicion(evento);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setValor(dataUrl);
    onCambio?.(true);
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setValor("");
    onCambio?.(false);
  }

  return (
    <div>
      <input type="hidden" name={name} value={valor} />

      <div className="relative rounded-lg border-2 border-dashed border-borde-fuerte bg-panel">
        <canvas
          ref={canvasRef}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          className="canvas-firma h-40 w-full rounded-lg"
        />
        {!valor && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-tinta-tenue">
            Firma aquí con el dedo o el mouse
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-tinta-tenue">
          La firma queda registrada en el acta de entrega.
        </p>
        <button
          type="button"
          onClick={limpiar}
          className="foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave transition-colors duration-150 hover:text-tinta"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
