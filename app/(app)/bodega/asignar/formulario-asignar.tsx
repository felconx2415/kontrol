"use client";

import { useActionState, useMemo, useState } from "react";
import { asignarItemBodega, type EstadoBodega } from "@/actions/bodega";
import FirmaCanvas from "@/components/firma-canvas";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";
import BuscadorArticulo, {
  type OpcionBuscador,
} from "@/components/buscador-articulo";
import { normalizar } from "@/lib/busqueda";

type ItemOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  stock: number;
};

type UsuarioOpcion = { id: string; nombre: string; brigada: string | null };

type Linea = {
  clave: string;
  itemId: string;
  cantidad: number;
  numeroSerie: string;
};

function nuevaClave(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Entrega definitiva de una o varias cosas a la misma persona.
 *
 * A quien se habilita se le entrega el casco, los guantes y la linterna en el
 * mismo acto, y firma una sola acta. Antes había que repetir el trámite
 * completo por cada ítem, firma incluida.
 */
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
  const [tieneFirma, setTieneFirma] = useState(false);

  const porId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const [lineas, setLineas] = useState<Linea[]>(() => {
    const inicial = items.find((i) => i.id === itemPreseleccionado);
    return inicial
      ? [{ clave: nuevaClave(), itemId: inicial.id, cantidad: 1, numeroSerie: "" }]
      : [];
  });

  // Lo ya agregado no se vuelve a ofrecer: la cantidad se ajusta en su línea.
  const opciones: OpcionBuscador[] = useMemo(
    () =>
      items
        .filter((i) => !lineas.some((l) => l.itemId === i.id))
        .map((i) => ({
          id: i.id,
          principal: i.nombre,
          secundario: `${i.codigo} · ${i.stock} ${i.unidad}`,
          buscable: normalizar(`${i.nombre} ${i.codigo}`),
        })),
    [items, lineas],
  );

  function agregar(itemId: string) {
    if (lineas.some((l) => l.itemId === itemId)) return;
    setLineas((prev) => [
      ...prev,
      { clave: nuevaClave(), itemId, cantidad: 1, numeroSerie: "" },
    ]);
  }

  function actualizar(clave: string, cambios: Partial<Linea>) {
    setLineas((prev) =>
      prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)),
    );
  }

  function quitar(clave: string) {
    setLineas((prev) => prev.filter((l) => l.clave !== clave));
  }

  // Espeja la validación del servidor para no dejar enviar algo imposible.
  const excedidas = lineas.filter((l) => {
    const item = porId.get(l.itemId);
    return item ? l.cantidad > item.stock : false;
  });

  const payload = JSON.stringify(
    lineas.map((l) => ({
      itemId: l.itemId,
      cantidad: l.cantidad,
      numeroSerie: l.numeroSerie.trim() || null,
    })),
  );

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="items" value={payload} />

      <Tarjeta className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Asignar a" htmlFor="usuarioId" className="sm:col-span-2">
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

        <Campo etiqueta="Nota (opcional)" htmlFor="notas" className="sm:col-span-2">
          <AreaTexto id="notas" name="notas" rows={2} placeholder="Detalle de la entrega" />
        </Campo>
      </Tarjeta>

      <section className="rounded-xl border border-borde bg-panel">
        <header className="border-b border-borde p-4">
          <h2 className="titulo-seccion mb-3">
            Equipamiento entregado{" "}
            <span className="text-fallo" aria-hidden="true">
              *
            </span>
          </h2>
          <BuscadorArticulo
            opciones={opciones}
            etiqueta="Ítem de la bodega"
            placeholder="Busca por nombre o código y toca para agregar…"
            onElegir={agregar}
          />
        </header>

        {lineas.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-tinta-tenue">
            Aún no has agregado equipamiento.
          </p>
        ) : (
          <ul className="divide-y divide-borde">
            {lineas.map((linea) => {
              const item = porId.get(linea.itemId);
              const excede = item ? linea.cantidad > item.stock : false;
              return (
                <li key={linea.clave} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item?.nombre}</p>
                      <p className="text-xs text-tinta-tenue">
                        {item?.codigo} · quedan {item?.stock} {item?.unidad}
                      </p>
                    </div>
                    <Boton
                      type="button"
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => quitar(linea.clave)}
                      className="text-fallo hover:bg-fallo-fondo hover:text-fallo"
                    >
                      Quitar
                    </Boton>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Campo
                      etiqueta="Cantidad"
                      htmlFor={`cant-${linea.clave}`}
                      error={excede ? `Solo quedan ${item?.stock}` : undefined}
                    >
                      <Entrada
                        id={`cant-${linea.clave}`}
                        type="number"
                        min={1}
                        max={item?.stock}
                        value={linea.cantidad}
                        onChange={(e) =>
                          actualizar(linea.clave, {
                            cantidad: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </Campo>

                    <Campo
                      etiqueta="N° de serie / lote (opcional)"
                      htmlFor={`serie-${linea.clave}`}
                    >
                      <Entrada
                        id={`serie-${linea.clave}`}
                        value={linea.numeroSerie}
                        onChange={(e) =>
                          actualizar(linea.clave, { numeroSerie: e.target.value })
                        }
                        placeholder="Solo si el equipo lo trae grabado"
                      />
                    </Campo>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Tarjeta>
        <h2 className="titulo-seccion mb-3">
          Firma de quien recibe{" "}
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
        disabled={!tieneFirma || lineas.length === 0 || excedidas.length > 0}
        textoPendiente="Asignando…"
      >
        {lineas.length > 1
          ? `Asignar ${lineas.length} ítems`
          : "Asignar equipamiento"}
      </Boton>
    </form>
  );
}
