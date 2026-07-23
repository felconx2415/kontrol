"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  alternarItemBodega,
  editarItemBodega,
  registrarMovimiento,
  type EstadoBodega,
} from "@/actions/bodega";
import {
  ETIQUETA_MOVIMIENTO,
  REQUIERE_PERSONA,
  TIPOS_MOVIMIENTO_MANUAL,
} from "@/lib/bodega";
import type { TipoMovimiento } from "@/generated/prisma/enums";
import Boton, { BotonEnlace } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion, AreaTexto } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import Insignia from "@/components/ui/insignia";

export type ItemFila = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  ubicacion: string | null;
  notas: string | null;
  stock: number;
  prestado: number;
  activo: boolean;
};

// Vista del panel que se despliega bajo la fila. Un dropdown flotante se
// recortaría contra el contenedor con scroll de la tabla, así que las acciones
// viven en una fila expandible (mismo patrón que editar y movimiento).
type Vista = "acciones" | "movimiento" | "editar" | null;

export default function FilaItemBodega({ item }: { item: ItemFila }) {
  const [vista, setVista] = useState<Vista>(null);

  const puedeSalir = item.activo && item.stock > 0;

  return (
    <>
      <tr
        className={`transition-colors duration-150 hover:bg-panel-suave ${
          item.activo ? "" : "text-tinta-tenue"
        }`}
      >
        <td data-label="Código" className="px-4 py-2.5 font-mono tabular-nums text-tinta-suave">
          {item.codigo}
        </td>
        <td data-label="Nombre" className="px-4 py-2.5">
          <Link
            href={`/bodega/${item.id}`}
            className="foco-anillo rounded font-medium text-tinta underline-offset-2 hover:underline"
          >
            {item.nombre}
          </Link>
        </td>
        <td data-label="Categoría" className="px-4 py-2.5 text-tinta-suave">
          {item.categoria}
        </td>
        <td data-label="Ubicación" className="px-4 py-2.5 text-tinta-suave">
          {item.ubicacion ?? "—"}
        </td>
        <td data-label="Stock" className="px-4 py-2.5 text-right font-mono tabular-nums">
          <span className={item.stock === 0 ? "text-fallo" : "text-tinta"}>
            {item.stock} {item.unidad}
          </span>
        </td>
        <td data-label="Prestado" className="px-4 py-2.5 text-right font-mono tabular-nums text-tinta-suave">
          {item.prestado > 0 ? item.prestado : "—"}
        </td>
        <td data-label="Estado" className="px-4 py-2.5">
          <Insignia
            clases={
              item.activo
                ? "bg-exito-fondo text-exito ring-exito-borde"
                : "bg-lienzo text-tinta-tenue ring-borde"
            }
          >
            {item.activo ? "Activo" : "Inactivo"}
          </Insignia>
        </td>
        <td className="celda-completa px-4 py-2.5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setVista((v) => (v ? null : "acciones"))}
              aria-haspopup="menu"
              aria-expanded={vista !== null}
              aria-label={`Acciones de ${item.nombre}`}
              className={`foco-anillo inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-lg leading-none transition-colors duration-150 hover:bg-panel-suave hover:text-tinta ${
                vista ? "bg-panel-suave text-tinta" : "text-tinta-suave"
              }`}
            >
              ⋯
            </button>
          </div>
        </td>
      </tr>

      {vista && (
        <tr className="bg-panel-suave">
          <td colSpan={8} className="celda-completa panel-expandible px-4 py-4">
            {vista === "acciones" && (
              <div className="flex flex-wrap items-center gap-2">
                <Boton
                  type="button"
                  tamano="sm"
                  variante="secundario"
                  onClick={() => setVista("movimiento")}
                >
                  Registrar movimiento
                </Boton>
                {puedeSalir && (
                  <BotonEnlace
                    href={`/bodega/prestar?item=${item.id}`}
                    tamano="sm"
                    variante="secundario"
                  >
                    Prestar
                  </BotonEnlace>
                )}
                {puedeSalir && (
                  <BotonEnlace
                    href={`/bodega/asignar?item=${item.id}`}
                    tamano="sm"
                    variante="secundario"
                  >
                    Asignar a usuario
                  </BotonEnlace>
                )}
                <Boton
                  type="button"
                  tamano="sm"
                  variante="secundario"
                  onClick={() => setVista("editar")}
                >
                  Editar
                </Boton>
                <form action={alternarItemBodega} className="contents">
                  <input type="hidden" name="itemId" value={item.id} />
                  <Boton type="submit" tamano="sm" variante="secundario">
                    {item.activo ? "Desactivar" : "Activar"}
                  </Boton>
                </form>
                <button
                  type="button"
                  onClick={() => setVista(null)}
                  className="foco-anillo ml-auto inline-flex min-h-9 cursor-pointer items-center rounded px-2 text-sm text-tinta-suave transition-colors duration-150 hover:text-tinta"
                >
                  Cerrar
                </button>
              </div>
            )}

            {vista === "movimiento" && (
              <PanelMovimiento item={item} onCerrar={() => setVista(null)} />
            )}
            {vista === "editar" && (
              <PanelEditar item={item} onCerrar={() => setVista(null)} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Movimiento de stock (ingreso/salida/ajuste) acotado a un ítem concreto. */
function PanelMovimiento({
  item,
  onCerrar,
}: {
  item: ItemFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    registrarMovimiento,
    {},
  );
  const [tipo, setTipo] = useState<TipoMovimiento>("ENTRADA");

  const pidePersona = REQUIERE_PERSONA.includes(tipo);
  const esAjuste = tipo === "AJUSTE";

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="itemId" value={item.id} />
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-4">
        Movimiento · {item.codigo} — {item.nombre}{" "}
        <span className="font-normal text-tinta-tenue">
          ({item.stock} {item.unidad} en stock)
        </span>
      </p>

      <Campo etiqueta="Tipo" htmlFor={`movTipo-${item.id}`}>
        <Seleccion
          id={`movTipo-${item.id}`}
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
        htmlFor={`movCantidad-${item.id}`}
        pista={esAjuste ? "Fija el stock a este valor." : undefined}
      >
        <Entrada
          id={`movCantidad-${item.id}`}
          name="cantidad"
          type="number"
          min={esAjuste ? 0 : 1}
          required
          defaultValue={esAjuste ? 0 : 1}
        />
      </Campo>

      {pidePersona && (
        <Campo
          etiqueta="¿A quién se entrega?"
          htmlFor={`movPersona-${item.id}`}
          className="sm:col-span-2"
        >
          <Entrada
            id={`movPersona-${item.id}`}
            name="persona"
            required
            placeholder="Nombre o brigada"
          />
        </Campo>
      )}

      <Campo
        etiqueta="Nota (opcional)"
        htmlFor={`movNotas-${item.id}`}
        className="sm:col-span-2 lg:col-span-2"
      >
        <AreaTexto
          id={`movNotas-${item.id}`}
          name="notas"
          rows={1}
          placeholder="Detalle del movimiento"
        />
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

      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Boton type="submit" tamano="sm" textoPendiente="Registrando…">
          Registrar movimiento
        </Boton>
        <Boton type="button" tamano="sm" variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </form>
  );
}

function PanelEditar({
  item,
  onCerrar,
}: {
  item: ItemFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    editarItemBodega,
    {},
  );

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="itemId" value={item.id} />
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Editar {item.codigo}
      </p>

      <Campo etiqueta="Código" htmlFor={`codigo-${item.id}`}>
        <Entrada id={`codigo-${item.id}`} name="codigo" required defaultValue={item.codigo} />
      </Campo>

      <Campo etiqueta="Nombre" htmlFor={`nombre-${item.id}`}>
        <Entrada id={`nombre-${item.id}`} name="nombre" required defaultValue={item.nombre} />
      </Campo>

      <Campo etiqueta="Categoría" htmlFor={`categoria-${item.id}`}>
        <Entrada id={`categoria-${item.id}`} name="categoria" defaultValue={item.categoria} />
      </Campo>

      <Campo etiqueta="Unidad" htmlFor={`unidad-${item.id}`}>
        <Entrada id={`unidad-${item.id}`} name="unidad" defaultValue={item.unidad} />
      </Campo>

      <Campo etiqueta="Ubicación (opcional)" htmlFor={`ubicacion-${item.id}`}>
        <Entrada
          id={`ubicacion-${item.id}`}
          name="ubicacion"
          defaultValue={item.ubicacion ?? ""}
          placeholder="Estante A-3"
        />
      </Campo>

      <Campo
        etiqueta="Notas (opcional)"
        htmlFor={`notas-${item.id}`}
        className="sm:col-span-2 lg:col-span-3"
      >
        <AreaTexto
          id={`notas-${item.id}`}
          name="notas"
          rows={2}
          defaultValue={item.notas ?? ""}
        />
      </Campo>

      <p className="text-xs text-tinta-tenue sm:col-span-2 lg:col-span-3">
        El stock no se edita aquí: cambia con los movimientos (ingreso, salida,
        ajuste).
      </p>

      {estado.error && (
        <Aviso tono="error" className="sm:col-span-2 lg:col-span-3">
          {estado.error}
        </Aviso>
      )}
      {estado.ok && (
        <Aviso tono="exito" className="sm:col-span-2 lg:col-span-3">
          {estado.ok}
        </Aviso>
      )}

      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Boton type="submit" tamano="sm" textoPendiente="Guardando…">
          Guardar cambios
        </Boton>
        <Boton type="button" tamano="sm" variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </form>
  );
}
