"use client";

import { useActionState, useState } from "react";
import { registrarEntrega, type EstadoEntrega } from "@/actions/entregas";
import FirmaCanvas from "@/components/firma-canvas";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Etiqueta, Seleccion } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";

type Item = {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  cantidadPedida: number;
  cantidadRecibida: number;
};

export type PersonaOpcion = { id: string; nombre: string; detalle: string };

/** Quién está firmando el acta. */
type ReceptorModo = "destinatario" | "usuario" | "manual";

export default function FormularioEntrega({
  solicitudId,
  items,
  retiroPropio = false,
  destinatarioNombre,
  personas = [],
}: {
  solicitudId: string;
  items: Item[];
  /** Firma el propio beneficiario porque retiró el material él mismo. */
  retiroPropio?: boolean;
  destinatarioNombre: string;
  /** Gente que puede retirar en nombre del destinatario. */
  personas?: PersonaOpcion[];
}) {
  const [estado, accion] = useActionState<EstadoEntrega, FormData>(
    registrarEntrega,
    {},
  );
  const [tieneFirma, setTieneFirma] = useState(false);
  const [modo, setModo] = useState<ReceptorModo>("destinatario");

  // Quien retira es quien firma, así que el rótulo de la firma tiene que
  // seguirlo: pedir «la firma del receptor» mientras firma un tercero es
  // exactamente lo que hace que las actas terminen firmadas por quien no era.
  const quienFirma = retiroPropio
    ? "Tu firma"
    : modo === "destinatario"
      ? `Firma de ${destinatarioNombre}`
      : "Firma de quien retira";

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

      {/* Solo gestión designa a un tercero: si el beneficiario firma su propio
          retiro, por definición es él quien recibe. */}
      {!retiroPropio && (
        <Tarjeta>
          <h2 className="titulo-seccion">¿Quién recibe?</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            El equipamiento queda a nombre de {destinatarioNombre} en cualquier
            caso. Esto es solo para dejar constancia de quién lo retiró y firmó.
          </p>

          <div className="mt-3 space-y-2">
            <OpcionReceptor
              valor="destinatario"
              actual={modo}
              onElegir={setModo}
              titulo={destinatarioNombre}
              detalle="El destinatario retira y firma."
            />
            <OpcionReceptor
              valor="usuario"
              actual={modo}
              onElegir={setModo}
              titulo="Otra persona con cuenta"
              detalle="Un compañero o supervisor registrado en Kontrol."
              deshabilitado={personas.length === 0}
            />
            <OpcionReceptor
              valor="manual"
              actual={modo}
              onElegir={setModo}
              titulo="Otra persona sin cuenta"
              detalle="Se anota su nombre y RUT a mano."
            />
          </div>

          <input type="hidden" name="receptorModo" value={modo} />

          {modo === "usuario" && (
            <div className="mt-3">
              <Campo etiqueta="Quién retira" htmlFor="recibidoPorId" requerido>
                <Seleccion id="recibidoPorId" name="recibidoPorId" required defaultValue="">
                  <option value="" disabled>
                    Elige a la persona
                  </option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {p.detalle ? ` · ${p.detalle}` : ""}
                    </option>
                  ))}
                </Seleccion>
              </Campo>
            </div>
          )}

          {modo === "manual" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Nombre de quien retira"
                htmlFor="recibidoPorNombre"
                requerido
              >
                <Entrada
                  id="recibidoPorNombre"
                  name="recibidoPorNombre"
                  required
                  minLength={3}
                  placeholder="Nombre y apellido"
                />
              </Campo>
              <Campo etiqueta="RUT (opcional)" htmlFor="recibidoPorRut">
                <Entrada
                  id="recibidoPorRut"
                  name="recibidoPorRut"
                  placeholder="12.345.678-9"
                />
              </Campo>
            </div>
          )}
        </Tarjeta>
      )}

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
          {quienFirma}{" "}
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

/**
 * Una de las tres formas de recibir, como tarjeta pulsable.
 *
 * Radios en vez de un `<select>`: son tres opciones con consecuencias distintas
 * y conviene verlas todas a la vez. El área pulsable es la tarjeta entera, no
 * el círculo, porque esto se usa en terreno y con guantes.
 */
function OpcionReceptor({
  valor,
  actual,
  onElegir,
  titulo,
  detalle,
  deshabilitado = false,
}: {
  valor: ReceptorModo;
  actual: ReceptorModo;
  onElegir: (v: ReceptorModo) => void;
  titulo: string;
  detalle: string;
  deshabilitado?: boolean;
}) {
  const elegida = actual === valor;

  return (
    <label
      className={`flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors duration-150 ${
        deshabilitado
          ? "cursor-not-allowed border-borde opacity-60"
          : `cursor-pointer ${
              elegida
                ? "border-marca-600 bg-marca-50"
                : "border-borde hover:bg-panel-suave"
            }`
      }`}
    >
      <input
        type="radio"
        name="receptorModoVisible"
        value={valor}
        checked={elegida}
        disabled={deshabilitado}
        onChange={() => onElegir(valor)}
        className="foco-anillo mt-0.5 size-5 shrink-0 cursor-pointer accent-marca-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-tinta">{titulo}</span>
        <span className="block text-xs text-tinta-suave">
          {deshabilitado ? "No hay otras cuentas en esta empresa." : detalle}
        </span>
      </span>
    </label>
  );
}
