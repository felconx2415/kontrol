"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearSolicitud, type EstadoFormulario } from "@/actions/solicitudes";
import {
  ETIQUETA_MOTIVO,
  MOTIVOS_NUEVO,
  MOTIVOS_REEMPLAZO,
} from "@/lib/solicitud-estado";
import { formatearFecha } from "@/lib/vencimientos";
import SubirFoto from "@/components/subir-foto";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Etiqueta, Seleccion } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";
import BuscadorArticulo, {
  normalizar,
  type OpcionBuscador,
} from "@/components/buscador-articulo";

type Articulo = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
};

export type Asignado = {
  entregaItemId: string;
  articuloId: string;
  articuloNombre: string;
  entregadoEn: string;
};

type Persona = {
  id: string;
  nombre: string;
  /** Brigada y RUT, para distinguir homónimos en la lista. */
  detalle: string;
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

/** Lo que se le pide a una persona concreta dentro del envío. */
type Carro = {
  tipo: "NUEVO" | "REEMPLAZO";
  items: ItemBorrador[];
};

const CARRO_VACIO: Carro = { tipo: "NUEVO", items: [] };

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
  { valor: "NUEVO", titulo: "Equipamiento nuevo" },
  { valor: "REEMPLAZO", titulo: "Reemplazo" },
] as const;

/**
 * La carga de una persona: qué tipo de solicitud es y qué ítems lleva.
 *
 * Cada persona tiene la suya porque no todos necesitan lo mismo: uno entra a la
 * brigada y pide su equipo completo, otro solo cambia el arnés vencido. Al ser
 * cargas independientes, cada una termina en su propia solicitud, que es como
 * el resto del sistema ya trata los pedidos.
 */
function CargaPersona({
  persona,
  carro,
  asignados,
  opcionesNuevo,
  articuloPorId,
  propia,
  conCabecera,
  onCarro,
  onQuitar,
}: {
  persona: Persona;
  carro: Carro;
  asignados: Asignado[];
  opcionesNuevo: OpcionBuscador[];
  articuloPorId: Map<string, Articulo>;
  /** La carga es del propio usuario que está escribiendo. */
  propia: boolean;
  conCabecera: boolean;
  onCarro: (cambios: Partial<Carro>) => void;
  onQuitar: (() => void) | null;
}) {
  const { tipo, items } = carro;

  // En un reemplazo solo se puede pedir algo que esa persona ya tiene asignado.
  const disponiblesParaReemplazo = useMemo(
    () =>
      asignados.filter(
        (a) => !items.some((i) => i.entregaAnteriorItemId === a.entregaItemId),
      ),
    [asignados, items],
  );

  const opcionesReemplazo: OpcionBuscador[] = useMemo(
    () =>
      disponiblesParaReemplazo.map((a) => ({
        id: a.entregaItemId,
        principal: a.articuloNombre,
        secundario: formatearFecha(a.entregadoEn),
        buscable: normalizar(a.articuloNombre),
      })),
    [disponiblesParaReemplazo],
  );

  function agregarNuevo(articuloId: string) {
    const articulo = articuloPorId.get(articuloId);
    if (!articulo) return;
    onCarro({
      items: [
        ...items,
        {
          clave: nuevaClave(),
          articuloId: articulo.id,
          cantidad: 1,
          motivo: MOTIVOS_NUEVO[0],
          detalleReemplazo: "",
          fotoEvidenciaUrl: null,
          entregaAnteriorItemId: null,
        },
      ],
    });
  }

  function agregarReemplazo(entregaItemId: string) {
    const asignado = asignados.find((a) => a.entregaItemId === entregaItemId);
    if (!asignado) return;
    onCarro({
      items: [
        ...items,
        {
          clave: nuevaClave(),
          articuloId: asignado.articuloId,
          cantidad: 1,
          motivo: MOTIVOS_REEMPLAZO[0],
          detalleReemplazo: "",
          fotoEvidenciaUrl: null,
          entregaAnteriorItemId: asignado.entregaItemId,
        },
      ],
    });
  }

  function actualizarItem(clave: string, cambios: Partial<ItemBorrador>) {
    onCarro({
      items: items.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)),
    });
  }

  function quitarItem(clave: string) {
    onCarro({ items: items.filter((i) => i.clave !== clave) });
  }

  function cambiarTipo(nuevo: "NUEVO" | "REEMPLAZO") {
    // Los ítems de un tipo no sirven para el otro.
    onCarro({ tipo: nuevo, items: [] });
  }

  return (
    <section className="rounded-xl border border-borde bg-panel">
      {conCabecera && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <div className="min-w-0">
            <h2 className="titulo-seccion truncate">
              {propia ? `Para mí · ${persona.nombre}` : persona.nombre}
            </h2>
            {persona.detalle && (
              <p className="truncate text-xs text-tinta-tenue">{persona.detalle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-tinta-tenue">
              {items.length} ítem{items.length === 1 ? "" : "s"}
            </span>
            {onQuitar && (
              <Boton
                type="button"
                variante="fantasma"
                tamano="sm"
                onClick={onQuitar}
                className="text-fallo hover:bg-fallo-fondo hover:text-fallo"
              >
                Quitar
              </Boton>
            )}
          </div>
        </header>
      )}

      <div className="border-b border-borde p-4">
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
                  name={`tipo-${persona.id}`}
                  className="sr-only"
                  checked={tipo === opcion.valor}
                  onChange={() => cambiarTipo(opcion.valor)}
                />
                <span className="block text-sm font-medium">{opcion.titulo}</span>
                <span className="mt-0.5 block text-xs text-tinta-suave">
                  {opcion.valor === "NUEVO"
                    ? propia
                      ? "Material que aún no tienes asignado."
                      : `Material que ${persona.nombre} aún no tiene asignado.`
                    : propia
                      ? "Cambiar algo que ya tienes por desgaste, daño o vencimiento."
                      : "Cambiar algo que ya tiene por desgaste, daño o vencimiento."}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="border-b border-borde p-4">
        {(tipo === "NUEVO" || asignados.length > 0) && (
          <BuscadorArticulo
            opciones={tipo === "NUEVO" ? opcionesNuevo : opcionesReemplazo}
            etiqueta={
              tipo === "NUEVO"
                ? `Artículo del catálogo${propia ? "" : ` para ${persona.nombre}`}`
                : `Ítem de ${propia ? "los tuyos" : persona.nombre} que se va a reemplazar`
            }
            placeholder={
              tipo === "NUEVO"
                ? "Busca por nombre o código y toca para agregar…"
                : "Busca el ítem que se va a reemplazar…"
            }
            onElegir={tipo === "NUEVO" ? agregarNuevo : agregarReemplazo}
          />
        )}

        {tipo === "REEMPLAZO" && asignados.length === 0 && (
          <p className="rounded-lg bg-panel-suave px-3 py-2 text-sm text-tinta-suave">
            {propia
              ? "No tienes equipamiento asignado todavía, así que no hay nada que reemplazar. Pide equipamiento nuevo."
              : `${persona.nombre} no tiene equipamiento asignado todavía, así que no hay nada que reemplazar. Pide equipamiento nuevo.`}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-tinta-tenue">
          {propia
            ? "Aún no has agregado ítems."
            : `Aún no has agregado ítems para ${persona.nombre}.`}
        </p>
      ) : (
        /* Filas divididas en vez de tarjetas dentro de la tarjeta: anidar
           superficies es siempre ruido visual. */
        <ul className="divide-y divide-borde">
          {items.map((item) => {
            const articulo = articuloPorId.get(item.articuloId);
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
                    onClick={() => quitarItem(item.clave)}
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
                        actualizarItem(item.clave, {
                          cantidad: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </Campo>

                  <Campo etiqueta="Motivo" htmlFor={`motivo-${item.clave}`} requerido>
                    <Seleccion
                      id={`motivo-${item.clave}`}
                      value={item.motivo}
                      onChange={(e) =>
                        actualizarItem(item.clave, { motivo: e.target.value })
                      }
                    >
                      {(tipo === "REEMPLAZO" ? MOTIVOS_REEMPLAZO : MOTIVOS_NUEVO).map(
                        (m) => (
                          <option key={m} value={m}>
                            {ETIQUETA_MOTIVO[m]}
                          </option>
                        ),
                      )}
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
                          actualizarItem(item.clave, {
                            detalleReemplazo: e.target.value,
                          })
                        }
                        placeholder="Describe qué le pasó al equipo…"
                      />
                    </Campo>

                    <SubirFoto
                      valor={item.fotoEvidenciaUrl}
                      onCambio={(url) =>
                        actualizarItem(item.clave, { fotoEvidenciaUrl: url })
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
  );
}

export default function FormularioSolicitud({
  articulos,
  asignadosPorPersona,
  personas,
  beneficiarios,
  miId,
  miNombre,
}: {
  articulos: Articulo[];
  /** Equipamiento vigente de cada destinatario, por id de usuario. */
  asignadosPorPersona: Record<string, Asignado[]>;
  /** Vacío si quien mira no puede solicitar a nombre de otro. */
  personas: Persona[];
  /** Vacío = el pedido es para uno mismo. */
  beneficiarios: Persona[];
  miId: string;
  miNombre: string;
}) {
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(
    crearSolicitud,
    {},
  );
  const router = useRouter();
  const [cambiandoPersonas, iniciarCambio] = useTransition();

  /**
   * La carga de cada persona, indexada por su id. Vive aquí y no en la URL
   * (donde sí van los destinatarios) porque el servidor no necesita conocerla
   * hasta el envío.
   */
  const [carros, setCarros] = useState<Record<string, Carro>>({});

  const esParaMi = beneficiarios.length === 0;

  // Sin destinatarios elegidos, el único destino es uno mismo.
  const destinos: Persona[] = esParaMi
    ? [{ id: miId, nombre: miNombre, detalle: "" }]
    : beneficiarios;

  const carroDe = (id: string) => carros[id] ?? CARRO_VACIO;

  function actualizarCarro(id: string, cambios: Partial<Carro>) {
    setCarros((prev) => ({ ...prev, [id]: { ...(prev[id] ?? CARRO_VACIO), ...cambios } }));
  }

  /**
   * Los destinatarios viajan en la URL: el servidor necesita saber quiénes son
   * para consultar qué tiene asignado cada uno y poder ofrecer reemplazos.
   */
  function irA(ids: string[]) {
    iniciarCambio(() => {
      router.replace(
        ids.length === 0
          ? "/solicitudes/nueva"
          : `/solicitudes/nueva?para=${ids.join(",")}`,
      );
    });
  }

  function agregarPersona(id: string) {
    if (beneficiarios.some((b) => b.id === id)) return;
    irA([...beneficiarios.map((b) => b.id), id]);
  }

  function quitarPersona(id: string) {
    // Se descarta también su carga: si vuelve a agregarse, empieza limpia.
    setCarros((prev) => {
      const resto = { ...prev };
      delete resto[id];
      return resto;
    });
    irA(beneficiarios.filter((b) => b.id !== id).map((b) => b.id));
  }

  const articuloPorId = useMemo(
    () => new Map(articulos.map((a) => [a.id, a])),
    [articulos],
  );

  const opcionesNuevo: OpcionBuscador[] = useMemo(
    () =>
      articulos.map((a) => ({
        id: a.id,
        principal: a.nombre,
        secundario: a.codigo,
        buscable: normalizar(`${a.nombre} ${a.codigo}`),
      })),
    [articulos],
  );

  // Quien ya está en la lista no vuelve a ofrecerse.
  const opcionesPersona: OpcionBuscador[] = useMemo(
    () =>
      personas
        .filter((p) => !beneficiarios.some((b) => b.id === p.id))
        .map((p) => ({
          id: p.id,
          principal: p.nombre,
          secundario: p.detalle,
          buscable: normalizar(`${p.nombre} ${p.detalle}`),
        })),
    [personas, beneficiarios],
  );

  // Espeja la validación del servidor para no dejar enviar algo incompleto.
  const sinItems = destinos.filter((d) => carroDe(d.id).items.length === 0);
  const incompleto = destinos.some((d) =>
    carroDe(d.id).items.some((i) => !i.motivo),
  );

  const totalItems = destinos.reduce((n, d) => n + carroDe(d.id).items.length, 0);

  const payload = JSON.stringify(
    destinos.map((d) => {
      const carro = carroDe(d.id);
      return {
        usuarioId: d.id,
        tipo: carro.tipo,
        items: carro.items.map((i) => ({
          articuloId: i.articuloId,
          cantidad: i.cantidad,
          motivo: i.motivo || null,
          detalleReemplazo: i.detalleReemplazo.trim() || null,
          fotoEvidenciaUrl: i.fotoEvidenciaUrl,
          entregaAnteriorItemId: i.entregaAnteriorItemId,
        })),
      };
    }),
  );

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="destinatarios" value={payload} />

      {personas.length > 0 && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-tinta-suave">Para quién es</p>
              <p className="mt-0.5 truncate text-sm font-medium">
                {esParaMi
                  ? `Para mí · ${miNombre}`
                  : `${beneficiarios.length} persona${
                      beneficiarios.length === 1 ? "" : "s"
                    } · una solicitud para cada una`}
              </p>
            </div>
            {!esParaMi && (
              <Boton
                type="button"
                variante="fantasma"
                tamano="sm"
                onClick={() => irA([])}
              >
                Pedir para mí
              </Boton>
            )}
          </div>

          <div className="mt-3" aria-busy={cambiandoPersonas || undefined}>
            <BuscadorArticulo
              opciones={opcionesPersona}
              etiqueta="Usuarios para los que solicitas"
              placeholder={
                esParaMi
                  ? "Busca a la persona por nombre, brigada o RUT…"
                  : "Agrega a otra persona…"
              }
              onElegir={agregarPersona}
            />
          </div>

          <p className="mt-2 text-xs text-tinta-tenue">
            {cambiandoPersonas
              ? "Actualizando…"
              : esParaMi
                ? "Agrega personas para cargarles equipamiento; cada una lleva lo suyo y recibe su propia solicitud."
                : "Cada persona tiene su propia carga más abajo. Al enviar se crea una solicitud por cada una, con su folio y su acta."}
          </p>
        </Tarjeta>
      )}

      {destinos.map((persona) => (
        <CargaPersona
          key={persona.id}
          persona={persona}
          carro={carroDe(persona.id)}
          asignados={asignadosPorPersona[persona.id] ?? []}
          opcionesNuevo={opcionesNuevo}
          articuloPorId={articuloPorId}
          propia={persona.id === miId}
          conCabecera={personas.length > 0}
          onCarro={(cambios) => actualizarCarro(persona.id, cambios)}
          onQuitar={esParaMi ? null : () => quitarPersona(persona.id)}
        />
      ))}

      <Tarjeta>
        <Etiqueta htmlFor="justificacion">Justificación (opcional)</Etiqueta>
        <AreaTexto
          id="justificacion"
          name="justificacion"
          rows={3}
          placeholder="Contexto que ayude a quien aprueba…"
        />
        {destinos.length > 1 && (
          <p className="mt-1.5 text-xs text-tinta-tenue">
            Se copia en todas las solicitudes del envío.
          </p>
        )}
      </Tarjeta>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {incompleto ? (
          <p className="text-sm text-tinta-tenue">
            Completa los campos obligatorios de cada ítem.
          </p>
        ) : (
          sinItems.length > 0 &&
          totalItems > 0 && (
            <p className="text-sm text-tinta-tenue">
              Falta agregar ítems a {sinItems.map((d) => d.nombre).join(", ")}.
            </p>
          )
        )}
        <Boton
          type="submit"
          disabled={sinItems.length > 0 || incompleto || cambiandoPersonas}
          textoPendiente="Enviando…"
        >
          {destinos.length > 1
            ? `Enviar ${destinos.length} solicitudes`
            : "Enviar solicitud"}
        </Boton>
      </div>
    </form>
  );
}
