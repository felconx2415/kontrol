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
  retiroPropio = false,
}: {
  solicitudId: string;
  items: Item[];
  /** Firma el propio beneficiario porque retiró el material él mismo. */
  retiroPropio?: boolean;
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
          {retiroPropio ? "Cantidades que retiras" : "Cantidades a entregar"}
        </h2>
        <ul className="divide-y divide-borde">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
              </div>

              {/* La serie se pide siempre pero no se exige: solo parte del
                  equipamiento la trae grabada, y forzarla llenaría el acta de
                  datos inventados. */}
              <label className="mt-2 flex items-center gap-2">
                <span className="shrink-0 text-xs text-tinta-suave">
                  N° de serie / lote
                </span>
                <Entrada
                  name={`serie_${item.id}`}
                  placeholder="Opcional"
                  className="max-w-xs"
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
          {retiroPropio ? "Tu firma" : "Firma del receptor"}{" "}
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
        textoPendiente="Registrando…"
      >
        {retiroPropio ? "Confirmar recepción" : "Confirmar entrega"}
      </Boton>
    </form>
  );
}
