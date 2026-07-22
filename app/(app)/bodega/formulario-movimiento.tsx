"use client";

import { useActionState, useState } from "react";
import { registrarMovimiento, type EstadoBodega } from "@/actions/bodega";
import {
  ETIQUETA_MOVIMIENTO,
  REQUIERE_PERSONA,
  TIPOS_MOVIMIENTO_MANUAL,
} from "@/lib/bodega";
import type { TipoMovimiento } from "@/generated/prisma/enums";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion, AreaTexto } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export type OpcionItem = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  stock: number;
};

export default function FormularioMovimiento({
  items,
}: {
  items: OpcionItem[];
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    registrarMovimiento,
    {},
  );
  const [tipo, setTipo] = useState<TipoMovimiento>("ENTRADA");

  const pidePersona = REQUIERE_PERSONA.includes(tipo);
  const esAjuste = tipo === "AJUSTE";

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-4">
        Registrar movimiento
      </p>

      <Campo etiqueta="Ítem" htmlFor="movItem" className="sm:col-span-2">
        <Seleccion id="movItem" name="itemId" required defaultValue="">
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

      <Campo etiqueta="Tipo" htmlFor="movTipo">
        <Seleccion
          id="movTipo"
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
        >
          {TIPOS_MOVIMIENTO_MANUAL.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_MOVIMIENTO[t]}
            </option>
          ))}
        </Seleccion>
      </Campo>

      <Campo
        etiqueta={esAjuste ? "Nuevo stock" : "Cantidad"}
        htmlFor="movCantidad"
        pista={esAjuste ? "Fija el stock a este valor." : undefined}
      >
        <Entrada
          id="movCantidad"
          name="cantidad"
          type="number"
          min={esAjuste ? 0 : 1}
          required
          defaultValue={esAjuste ? 0 : 1}
        />
      </Campo>

      {pidePersona && (
        <Campo
          etiqueta={tipo === "PRESTAMO" ? "¿A quién se presta?" : "¿A quién se entrega?"}
          htmlFor="movPersona"
          className="sm:col-span-2"
        >
          <Entrada id="movPersona" name="persona" required placeholder="Nombre o brigada" />
        </Campo>
      )}

      <Campo etiqueta="Nota (opcional)" htmlFor="movNotas" className="sm:col-span-2 lg:col-span-2">
        <AreaTexto id="movNotas" name="notas" rows={1} placeholder="Detalle del movimiento" />
      </Campo>

      {estado.error && (
        <Aviso tono="error" className="sm:col-span-2 lg:col-span-4">
          {estado.error}
        </Aviso>
      )}
      {estado.ok && (
        <Aviso tono="exito" className="sm:col-span-2 lg:col-span-4">
          {estado.ok}
        </Aviso>
      )}

      <div className="sm:col-span-2 lg:col-span-4">
        <Boton type="submit" textoPendiente="Registrando…">
          Registrar movimiento
        </Boton>
      </div>
    </form>
  );
}
