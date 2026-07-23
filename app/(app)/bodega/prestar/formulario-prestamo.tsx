"use client";

import { useActionState, useState } from "react";
import { registrarPrestamo, type EstadoBodega } from "@/actions/bodega";
import FirmaCanvas from "@/components/firma-canvas";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";

type ItemOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  stock: number;
};

export default function FormularioPrestamo({
  items,
  itemPreseleccionado,
}: {
  items: ItemOpcion[];
  itemPreseleccionado?: string;
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    registrarPrestamo,
    {},
  );
  const [tieneFirma, setTieneFirma] = useState(false);

  const preseleccion = items.some((i) => i.id === itemPreseleccionado)
    ? itemPreseleccionado
    : "";

  return (
    <form action={accion} className="space-y-6">
      <Tarjeta className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Ítem" htmlFor="itemId" className="sm:col-span-2">
          <Seleccion id="itemId" name="itemId" required defaultValue={preseleccion}>
            <option value="" disabled>
              Selecciona un ítem…
            </option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} — {i.nombre} ({i.stock} {i.unidad})
              </option>
            ))}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Cantidad" htmlFor="cantidad">
          <Entrada id="cantidad" name="cantidad" type="number" min={1} defaultValue={1} required />
        </Campo>

        <Campo etiqueta="¿A quién se presta?" htmlFor="persona">
          <Entrada id="persona" name="persona" required placeholder="Nombre o brigada" />
        </Campo>

        <Campo etiqueta="Nota (opcional)" htmlFor="notas" className="sm:col-span-2">
          <AreaTexto id="notas" name="notas" rows={2} placeholder="Detalle del préstamo" />
        </Campo>
      </Tarjeta>

      <Tarjeta>
        <h2 className="titulo-seccion mb-3">
          Firma de salida (quien recibe){" "}
          <span className="text-fallo" aria-hidden="true">
            *
          </span>
        </h2>
        <FirmaCanvas name="firmaSalida" onCambio={setTieneFirma} />
      </Tarjeta>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      <Boton
        type="submit"
        bloque
        disabled={!tieneFirma}
        textoPendiente="Registrando préstamo…"
      >
        Registrar préstamo
      </Boton>
    </form>
  );
}
