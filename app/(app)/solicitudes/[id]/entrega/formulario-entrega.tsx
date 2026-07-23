"use client";

import { useActionState, useState } from "react";
import { registrarEntrega, type EstadoEntrega } from "@/actions/entregas";
import FirmaCanvas from "@/components/firma-canvas";
import Boton from "@/components/ui/boton";
import { AreaTexto, Entrada, Etiqueta } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";

type Item = {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  cantidadPedida: number;
  cantidadRecibida: number;
};

export default function FormularioEntrega({
  solicitudId,
  items,
}: {
  solicitudId: string;
  items: Item[];
}) {
  const [estado, accion] = useActionState<EstadoEntrega, FormData>(
    registrarEntrega,
    {},
  );
  const [tieneFirma, setTieneFirma] = useState(false);

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="solicitudId" value={solicitudId} />

      <section className="rounded-xl border border-borde bg-panel">
        <h2 className="titulo-seccion border-b border-borde px-4 py-3">
          Cantidades a entregar
        </h2>
        <ul className="divide-y divide-borde">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{item.nombre}</p>
                <p className="text-xs text-tinta-tenue">
                  {item.codigo} · pedido: {item.cantidadPedida} {item.unidad}
                  {item.cantidadPedida === 1 ? "" : "s"}
                  {item.cantidadRecibida !== item.cantidadPedida && (
                    <span className="text-espera">
                      {" "}
                      · recibido: {item.cantidadRecibida}
                    </span>
                  )}
                </p>
              </div>
              <label className="flex items-center gap-2">
                <span className="text-xs text-tinta-suave">Entregar</span>
                <Entrada
                  type="number"
                  name={`cantidad_${item.id}`}
                  min={0}
                  max={item.cantidadRecibida}
                  defaultValue={item.cantidadRecibida}
                  className="w-20 tabular-nums"
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <Tarjeta>
        <Etiqueta htmlFor="observaciones">Observaciones (opcional)</Etiqueta>
        <AreaTexto
          id="observaciones"
          name="observaciones"
          rows={2}
          placeholder="Ej: se entrega un par de guantes menos, queda pendiente."
        />
      </Tarjeta>

      <Tarjeta>
        <h2 className="titulo-seccion mb-3">
          Firma del receptor{" "}
          <span className="text-fallo" aria-hidden="true">
            *
          </span>
        </h2>
        <FirmaCanvas name="firma" onCambio={setTieneFirma} />
      </Tarjeta>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      <Boton
        type="submit"
        bloque
        disabled={!tieneFirma}
        textoPendiente="Registrando entrega…"
      >
        Confirmar entrega
      </Boton>
    </form>
  );
}
