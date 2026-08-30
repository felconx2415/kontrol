"use client";

import { useActionState, useMemo, useState } from "react";
import { asignarItemBodega, type EstadoBodega } from "@/actions/bodega";
import FirmaCanvas from "@/components/firma-canvas";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";
import OpcionTarjeta from "@/components/opcion-tarjeta";
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

export type UsuarioOpcion = {
  id: string;
  nombre: string;
  brigada: string | null;
  cargo: string | null;
};

export type BrigadaOpcion = { id: string; nombre: string; miembros: number };

/** A nombre de quién queda el equipamiento. */
type Destino = "usuario" | "brigada";

/** Quién vino a buscarlo y firma. */
type Retiro = "dueno" | "usuario" | "manual";

/** Nombre y cargo de una persona, como se lee en un desplegable. */
function etiquetaPersona(u: UsuarioOpcion): string {
  const detalle = [u.cargo, u.brigada].filter(Boolean).join(" · ");
  return detalle ? `${u.nombre} · ${detalle}` : u.nombre;
}

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
 * Entrega definitiva de una o varias cosas al mismo destinatario.
 *
 * A quien se habilita se le entrega el casco, los guantes y la linterna en el
 * mismo acto, y firma una sola acta. Antes había que repetir el trámite
 * completo por cada ítem, firma incluida.
 *
 * El destinatario es una persona o una **brigada**: hay material que es de la
 * cuadrilla —la motosierra, la carpa, el botiquín— y no de quien ese día fue a
 * buscarlo. Como una brigada no tiene manos, en ese caso siempre hay que decir
 * quién retira: es su firma la que queda en el acta.
 */
export default function FormularioAsignar({
  items,
  usuarios,
  brigadas,
  itemPreseleccionado,
}: {
  items: ItemOpcion[];
  usuarios: UsuarioOpcion[];
  brigadas: BrigadaOpcion[];
  itemPreseleccionado?: string;
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    asignarItemBodega,
    {},
  );
  const [tieneFirma, setTieneFirma] = useState(false);
  const [destino, setDestino] = useState<Destino>("usuario");
  const [retiro, setRetiro] = useState<Retiro>("dueno");

  // Una brigada no puede retirar por sí misma: al cambiar de destinatario, la
  // opción «el dueño retira» deja de existir y hay que nombrar a alguien.
  function cambiarDestino(nuevo: Destino) {
    setDestino(nuevo);
    if (nuevo === "brigada" && retiro === "dueno") setRetiro("usuario");
  }

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

      <Tarjeta>
        <h2 className="titulo-seccion">¿A nombre de quién queda?</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Lo de una persona vive en su «Mi equipamiento» y la sigue. Lo de la
          brigada es de la cuadrilla y se queda en ella aunque su gente cambie.
        </p>

        <div className="mt-3 space-y-2">
          <OpcionTarjeta
            grupo="destinoVisible"
            valor="usuario"
            actual={destino}
            onElegir={cambiarDestino}
            titulo="Una persona"
            detalle="Casco, guantes, ropa: lo que es de quien lo usa."
            deshabilitado={usuarios.length === 0}
            detalleDeshabilitado="No hay cuentas activas en esta empresa."
          />
          <OpcionTarjeta
            grupo="destinoVisible"
            valor="brigada"
            actual={destino}
            onElegir={cambiarDestino}
            titulo="Una brigada"
            detalle="Motosierra, carpa, botiquín: lo que es de la cuadrilla."
            deshabilitado={brigadas.length === 0}
            detalleDeshabilitado="No hay brigadas en esta empresa."
          />
        </div>

        <input type="hidden" name="destino" value={destino} />

        <div className="mt-3">
          {destino === "usuario" ? (
            <Campo etiqueta="Persona" htmlFor="usuarioId" requerido>
              <Seleccion id="usuarioId" name="usuarioId" required defaultValue="">
                <option value="" disabled>
                  Selecciona un usuario…
                </option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {etiquetaPersona(u)}
                  </option>
                ))}
              </Seleccion>
            </Campo>
          ) : (
            <Campo etiqueta="Brigada" htmlFor="brigadaId" requerido>
              <Seleccion id="brigadaId" name="brigadaId" required defaultValue="">
                <option value="" disabled>
                  Selecciona una brigada…
                </option>
                {brigadas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} · {b.miembros} persona
                    {b.miembros === 1 ? "" : "s"}
                  </option>
                ))}
              </Seleccion>
            </Campo>
          )}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="titulo-seccion">¿Quién retira?</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {destino === "brigada"
            ? "El equipamiento queda a nombre de la brigada en cualquier caso. Esto es para dejar constancia de quién vino a buscarlo y firmó."
            : "El equipamiento queda a nombre de la persona en cualquier caso. Esto es solo para dejar constancia de quién lo retiró y firmó."}
        </p>

        <div className="mt-3 space-y-2">
          {/* Una brigada no tiene manos: sin esta opción, la firma del acta no
              correspondería a nadie. Por eso desaparece al elegir brigada en
              vez de quedarse ahí sin sentido. */}
          {destino === "usuario" && (
            <OpcionTarjeta
              grupo="retiroVisible"
              valor="dueno"
              actual={retiro}
              onElegir={setRetiro}
              titulo="La misma persona"
              detalle="Retira y firma quien recibe el equipamiento."
            />
          )}
          <OpcionTarjeta
            grupo="retiroVisible"
            valor="usuario"
            actual={retiro}
            onElegir={setRetiro}
            titulo="Otra persona con cuenta"
            detalle="Un compañero o el supervisor, registrado en Kontrol."
            deshabilitado={usuarios.length === 0}
            detalleDeshabilitado="No hay otras cuentas en esta empresa."
          />
          <OpcionTarjeta
            grupo="retiroVisible"
            valor="manual"
            actual={retiro}
            onElegir={setRetiro}
            titulo="Alguien sin cuenta"
            detalle="Se anota su nombre y RUT a mano."
          />
        </div>

        <input type="hidden" name="retiroModo" value={retiro} />

        {retiro === "usuario" && (
          <div className="mt-3">
            <Campo etiqueta="Quién retira" htmlFor="retiradoPorId" requerido>
              <Seleccion
                id="retiradoPorId"
                name="retiradoPorId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Elige a la persona
                </option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {etiquetaPersona(u)}
                  </option>
                ))}
              </Seleccion>
            </Campo>
          </div>
        )}

        {retiro === "manual" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre de quien retira"
              htmlFor="retiradoPorNombre"
              requerido
            >
              <Entrada
                id="retiradoPorNombre"
                name="retiradoPorNombre"
                required
                minLength={3}
                placeholder="Nombre y apellido"
              />
            </Campo>
            <Campo etiqueta="RUT (opcional)" htmlFor="retiradoPorRut">
              <Entrada
                id="retiradoPorRut"
                name="retiradoPorRut"
                placeholder="12.345.678-9"
              />
            </Campo>
          </div>
        )}

        <div className="mt-3">
          <Campo etiqueta="Nota (opcional)" htmlFor="notas">
            <AreaTexto
              id="notas"
              name="notas"
              rows={2}
              placeholder="Detalle de la entrega"
            />
          </Campo>
        </div>
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
        {/* Quien retira es quien firma, así que el rótulo tiene que seguirlo:
            pedir «la firma de quien recibe» mientras firma un tercero es lo que
            hace que las actas terminen firmadas por quien no era. */}
        <h2 className="titulo-seccion mb-3">
          {retiro === "dueno" ? "Firma de quien recibe" : "Firma de quien retira"}{" "}
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
