"use client";

import { useActionState } from "react";
import { asignarItemBodega, type EstadoBodega } from "@/actions/bodega";
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

type UsuarioOpcion = { id: string; nombre: string; brigada: string | null };

export default function FormularioAsignar({
  items,
  usuarios,
  itemPreseleccionado,
}: {
  items: ItemOpcion[];
  usuarios: UsuarioOpcion[];
  itemPreseleccionado?: string;
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    asignarItemBodega,
    {},
  );

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

        <Campo etiqueta="Asignar a" htmlFor="usuarioId">
          <Seleccion id="usuarioId" name="usuarioId" required defaultValue="">
            <option value="" disabled>
              Selecciona un usuario…
            </option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
                {u.brigada ? ` · ${u.brigada}` : ""}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Cantidad" htmlFor="cantidad">
          <Entrada id="cantidad" name="cantidad" type="number" min={1} defaultValue={1} required />
        </Campo>

        <Campo etiqueta="Nota (opcional)" htmlFor="notas" className="sm:col-span-2">
          <AreaTexto id="notas" name="notas" rows={2} placeholder="Detalle de la asignación" />
        </Campo>
      </Tarjeta>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      <Boton type="submit" bloque textoPendiente="Asignando…">
        Asignar equipamiento
      </Boton>
    </form>
  );
}
