"use client";

import { useActionState, useMemo, useState } from "react";
import { crearSolicitud, type EstadoFormulario } from "@/actions/solicitudes";
import {
  ETIQUETA_MOTIVO,
  MOTIVOS_NUEVO,
  MOTIVOS_REEMPLAZO,
} from "@/lib/solicitud-estado";
import SubirFoto from "@/components/subir-foto";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Etiqueta, Seleccion } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";
import BuscadorArticulo, {
  normalizar,
  type OpcionBuscador,
} from "./buscador-articulo";

type Articulo = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
};

type Asignado = {
  entregaItemId: string;
  articuloId: string;
  articuloNombre: string;
  entregadoEn: string;
};

type ItemBorrador = {
  clave: string;
  articuloId: string;
  cantidad: number;
  motivo: string;
  detalleReemplazo: string;
  fotoEvidenciaUrl: string | null;
  entregaAnteriorItemId: string | null;
};

/**
 * Id local para los ítems del borrador (solo sirve como `key` de React).
 * `crypto.randomUUID` no existe en contextos no seguros —como abrir la app por
 * la IP de la LAN en http—, así que hay un respaldo que no depende de él.
 */
function nuevaClave(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const TIPOS = [
  {
    valor: "NUEVO",
    titulo: "Equipamiento nuevo",
    detalle: "Material que aún no tienes asignado.",
  },
  {
    valor: "REEMPLAZO",
    titulo: "Reemplazo",
    detalle: "Cambiar algo que ya tienes por desgaste, daño o vencimiento.",
  },
] as const;

export default function FormularioSolicitud({
  articulos,
  asignados,
}: {
  articulos: Articulo[];
  asignados: Asignado[];
}) {
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(
    crearSolicitud,
    {},
  );

  const [tipo, setTipo] = useState<"NUEVO" | "REEMPLAZO">("NUEVO");
  const [items, setItems] = useState<ItemBorrador[]>([]);

  const porId = useMemo(
    () => new Map(articulos.map((a) => [a.id, a])),
    [articulos],
  );

  // En un reemplazo solo se puede pedir algo que ya se tiene asignado.
  const disponiblesParaReemplazo = useMemo(
    () =>
      asignados.filter(
        (a) => !items.some((i) => i.entregaAnteriorItemId === a.entregaItemId),
      ),
    [asignados, items],
  );

  // Opciones del buscador según el tipo de solicitud.
  const opcionesNuevo: OpcionBuscador[] = useMemo(
    () =>
      articulos.map((a) => ({
        id: a.id,
        principal: `${a.categoria === "EPP" ? "EPP" : "Equipo"} · ${a.nombre}`,
        secundario: a.codigo,
        buscable: normalizar(`${a.nombre} ${a.codigo}`),
      })),
    [articulos],
  );

  const opcionesReemplazo: OpcionBuscador[] = useMemo(
    () =>
      disponiblesParaReemplazo.map((a) => ({
        id: a.entregaItemId,
        principal: a.articuloNombre,
        secundario: new Date(a.entregadoEn).toLocaleDateString("es-CL"),
        buscable: normalizar(a.articuloNombre),
      })),
    [disponiblesParaReemplazo],
  );

  function agregarNuevo(articuloId: string) {
    const articulo = porId.get(articuloId);
    if (!articulo) return;
    setItems((prev) => [
      ...prev,
      {
        clave: nuevaClave(),
        articuloId: articulo.id,
        cantidad: 1,
        motivo: MOTIVOS_NUEVO[0],
        detalleReemplazo: "",
        fotoEvidenciaUrl: null,
        entregaAnteriorItemId: null,
      },
    ]);
  }

  function agregarReemplazo(entregaItemId: string) {
    const asignado = asignados.find((a) => a.entregaItemId === entregaItemId);
    if (!asignado) return;
    setItems((prev) => [
      ...prev,
      {
        clave: nuevaClave(),
        articuloId: asignado.articuloId,
        cantidad: 1,
        motivo: MOTIVOS_REEMPLAZO[0],
        detalleReemplazo: "",
        fotoEvidenciaUrl: null,
        entregaAnteriorItemId: asignado.entregaItemId,
      },
    ]);
  }

  function actualizar(clave: string, cambios: Partial<ItemBorrador>) {
    setItems((prev) =>
      prev.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)),
    );
  }

  function quitar(clave: string) {
    setItems((prev) => prev.filter((i) => i.clave !== clave));
  }

  function cambiarTipo(nuevo: "NUEVO" | "REEMPLAZO") {
    setTipo(nuevo);
    setItems([]); // los ítems de un tipo no sirven para el otro
  }

  // Espeja la validación del servidor para no dejar enviar algo incompleto.
  const incompleto = items.some((i) => !i.motivo);

  const payload = JSON.stringify(
    items.map((i) => ({
      articuloId: i.articuloId,
      cantidad: i.cantidad,
      motivo: i.motivo || null,
      detalleReemplazo: i.detalleReemplazo.trim() || null,
      fotoEvidenciaUrl: i.fotoEvidenciaUrl,
      entregaAnteriorItemId: i.entregaAnteriorItemId,
    })),
  );

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="items" value={payload} />

      <Tarjeta>
        <fieldset>
          <legend className="text-sm font-medium text-tinta-suave">
            Tipo de solicitud
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {TIPOS.map((opcion) => (
              <label
                key={opcion.valor}
                /* focus-within es imprescindible: el radio es sr-only, así que
                   sin esto la navegación por teclado no muestra foco alguno. */
                className={`cursor-pointer rounded-lg border p-3 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca-600 ${
                  tipo === opcion.valor
                    ? "border-marca-600 bg-marca-50 ring-1 ring-marca-600"
                    : "border-borde hover:border-borde-fuerte hover:bg-panel-suave"
                }`}
              >
                <input
                  type="radio"
                  name="tipoVisual"
                  className="sr-only"
                  checked={tipo === opcion.valor}
                  onChange={() => cambiarTipo(opcion.valor)}
                />
                <span className="block text-sm font-medium">{opcion.titulo}</span>
                <span className="mt-0.5 block text-xs text-tinta-suave">
                  {opcion.detalle}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Tarjeta>

      <section className="rounded-xl border border-borde bg-panel">
        <header className="border-b border-borde p-4">
          <h2 className="mb-3 text-sm font-medium text-tinta-suave">Ítems</h2>
          {(tipo === "NUEVO" || asignados.length > 0) && (
            <BuscadorArticulo
              opciones={tipo === "NUEVO" ? opcionesNuevo : opcionesReemplazo}
              etiqueta={
                tipo === "NUEVO"
                  ? "Artículo del catálogo"
                  : "Ítem que quieres reemplazar"
              }
              placeholder={
                tipo === "NUEVO"
                  ? "Busca por nombre o código y toca para agregar…"
                  : "Busca el ítem que quieres reemplazar…"
              }
              onElegir={tipo === "NUEVO" ? agregarNuevo : agregarReemplazo}
            />
          )}

          {tipo === "REEMPLAZO" && asignados.length === 0 && (
            <p className="mt-3 rounded-lg bg-panel-suave px-3 py-2 text-sm text-tinta-suave">
              No tienes equipamiento asignado todavía, así que no hay nada que
              reemplazar. Crea una solicitud de equipamiento nuevo.
            </p>
          )}
        </header>

        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-tinta-tenue">
            Aún no has agregado ítems.
          </p>
        ) : (
          /* Filas divididas en vez de tarjetas dentro de la tarjeta: anidar
             superficies es siempre ruido visual. */
          <ul className="divide-y divide-borde">
            {items.map((item) => {
              const articulo = porId.get(item.articuloId);
              return (
                <li key={item.clave} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{articulo?.nombre}</p>
                      <p className="text-xs text-tinta-tenue">{articulo?.codigo}</p>
                    </div>
                    <Boton
                      type="button"
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => quitar(item.clave)}
                      className="text-fallo hover:bg-fallo-fondo hover:text-fallo"
                    >
                      Quitar
                    </Boton>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta="Cantidad" htmlFor={`cant-${item.clave}`}>
                      <Entrada
                        id={`cant-${item.clave}`}
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizar(item.clave, {
                            cantidad: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </Campo>

                    <Campo
                      etiqueta="Motivo"
                      htmlFor={`motivo-${item.clave}`}
                      requerido
                    >
                      <Seleccion
                        id={`motivo-${item.clave}`}
                        value={item.motivo}
                        onChange={(e) =>
                          actualizar(item.clave, { motivo: e.target.value })
                        }
                      >
                        {(tipo === "REEMPLAZO"
                          ? MOTIVOS_REEMPLAZO
                          : MOTIVOS_NUEVO
                        ).map((m) => (
                          <option key={m} value={m}>
                            {ETIQUETA_MOTIVO[m]}
                          </option>
                        ))}
                      </Seleccion>
                    </Campo>
                  </div>

                  {tipo === "REEMPLAZO" && (
                    <div className="mt-3 space-y-3 border-t border-borde pt-3">
                      <Campo
                        etiqueta="Detalle (opcional)"
                        htmlFor={`detalle-${item.clave}`}
                      >
                        <AreaTexto
                          id={`detalle-${item.clave}`}
                          rows={2}
                          value={item.detalleReemplazo}
                          onChange={(e) =>
                            actualizar(item.clave, {
                              detalleReemplazo: e.target.value,
                            })
                          }
                          placeholder="Describe qué le pasó al equipo…"
                        />
                      </Campo>

                      <SubirFoto
                        valor={item.fotoEvidenciaUrl}
                        onCambio={(url) =>
                          actualizar(item.clave, { fotoEvidenciaUrl: url })
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Tarjeta>
        <Etiqueta htmlFor="justificacion">Justificación (opcional)</Etiqueta>
        <AreaTexto
          id="justificacion"
          name="justificacion"
          rows={3}
          placeholder="Contexto que ayude a quien aprueba…"
        />
      </Tarjeta>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {incompleto && (
          <p className="text-sm text-tinta-tenue">
            Completa los campos obligatorios de cada ítem.
          </p>
        )}
        <Boton
          type="submit"
          disabled={items.length === 0 || incompleto}
          textoPendiente="Enviando…"
        >
          Enviar solicitud
        </Boton>
      </div>
    </form>
  );
}
