"use client";

import { useState } from "react";
import { useActionState } from "react";
import { devolverPrestamo, type EstadoBodega } from "@/actions/bodega";
import FirmaCanvas from "@/components/firma-canvas";
import SubirFotos from "@/components/subir-fotos";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Etiqueta } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";

type Linea = {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  cantidad: number;
  numeroSerie: string | null;
};

type EstadoVuelta = "BUENO" | "DANADO" | "PERDIDO";

type Revision = {
  estado: EstadoVuelta;
  observacion: string;
  fotos: string[];
};

const OPCIONES: { valor: EstadoVuelta; titulo: string; detalle: string }[] = [
  { valor: "BUENO", titulo: "En buen estado", detalle: "Vuelve al stock sin novedad." },
  { valor: "DANADO", titulo: "Con daños", detalle: "Vuelve al stock, pero hay que revisarlo." },
  { valor: "PERDIDO", titulo: "No volvió", detalle: "No se repone stock: no está." },
];

/**
 * Devolución de un préstamo, revisando ítem por ítem.
 *
 * El estado se pide por línea porque es lo que realmente se hace al recibir:
 * se mira cada cosa. De un mismo préstamo una herramienta puede volver intacta
 * y la de al lado partida, y el acta tiene que poder decirlo.
 *
 * Cuando algo no vuelve bien se exige describir qué pasó: un «dañado» sin
 * explicación no sirve para reclamar ni para decidir si se da de baja.
 */
export default function FormularioDevolucion({
  prestamoId,
  lineas,
}: {
  prestamoId: string;
  lineas: Linea[];
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    devolverPrestamo,
    {},
  );
  const [tieneFirma, setTieneFirma] = useState(false);

  const [revisiones, setRevisiones] = useState<Record<string, Revision>>(() =>
    Object.fromEntries(
      lineas.map((l) => [l.id, { estado: "BUENO" as EstadoVuelta, observacion: "", fotos: [] }]),
    ),
  );

  function actualizar(id: string, cambios: Partial<Revision>) {
    setRevisiones((prev) => ({ ...prev, [id]: { ...prev[id], ...cambios } }));
  }

  // Lo que no vuelve bien necesita explicación; se espeja la regla del servidor.
  const sinExplicar = lineas.filter((l) => {
    const r = revisiones[l.id];
    return r && r.estado !== "BUENO" && !r.observacion.trim();
  });

  const conNovedad = lineas.filter((l) => revisiones[l.id]?.estado !== "BUENO");

  const payload = JSON.stringify(
    lineas.map((l) => ({
      lineaId: l.id,
      estado: revisiones[l.id]?.estado ?? "BUENO",
      observacion: revisiones[l.id]?.observacion.trim() || null,
      fotos: revisiones[l.id]?.fotos ?? [],
    })),
  );

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="prestamoId" value={prestamoId} />
      <input type="hidden" name="devoluciones" value={payload} />

      <section className="rounded-xl border border-borde bg-panel">
        <h2 className="titulo-seccion border-b border-borde px-4 py-3">
          Cómo vuelve cada ítem
        </h2>
        <ul className="divide-y divide-borde">
          {lineas.map((linea) => {
            const revision = revisiones[linea.id];
            const conDanos = revision?.estado !== "BUENO";
            return (
              <li key={linea.id} className="p-4">
                <div>
                  <p className="text-sm font-medium">{linea.nombre}</p>
                  <p className="text-xs text-tinta-tenue">
                    {linea.codigo} · {linea.cantidad} {linea.unidad}
                    {linea.cantidad === 1 ? "" : "s"}
                    {linea.numeroSerie ? ` · serie ${linea.numeroSerie}` : ""}
                  </p>
                </div>

                <fieldset className="mt-3">
                  <legend className="sr-only">Estado de {linea.nombre}</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {OPCIONES.map((opcion) => (
                      <label
                        key={opcion.valor}
                        className={`cursor-pointer rounded-lg border p-2.5 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca-600 ${
                          revision?.estado === opcion.valor
                            ? opcion.valor === "BUENO"
                              ? "border-exito bg-exito-fondo ring-1 ring-exito"
                              : "border-fallo bg-fallo-fondo ring-1 ring-fallo"
                            : "border-borde hover:border-borde-fuerte hover:bg-panel-suave"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`estado-${linea.id}`}
                          className="sr-only"
                          checked={revision?.estado === opcion.valor}
                          onChange={() => actualizar(linea.id, { estado: opcion.valor })}
                        />
                        <span className="block text-sm font-medium">{opcion.titulo}</span>
                        <span className="mt-0.5 block text-xs text-tinta-suave">
                          {opcion.detalle}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {conDanos && (
                  <div className="mt-3 space-y-3 border-t border-borde pt-3">
                    <Campo
                      etiqueta="¿Qué pasó?"
                      htmlFor={`obs-${linea.id}`}
                      requerido
                      error={
                        revision && !revision.observacion.trim()
                          ? "Describe la novedad para poder respaldarla."
                          : undefined
                      }
                    >
                      <AreaTexto
                        id={`obs-${linea.id}`}
                        rows={2}
                        value={revision?.observacion ?? ""}
                        onChange={(e) =>
                          actualizar(linea.id, { observacion: e.target.value })
                        }
                        placeholder="Ej: vuelve con la carcasa rajada y sin el cargador."
                      />
                    </Campo>

                    <SubirFotos
                      valor={revision?.fotos ?? []}
                      onCambio={(fotos) => actualizar(linea.id, { fotos })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Tarjeta>
        <Etiqueta htmlFor="observaciones">
          Observaciones generales (opcional)
        </Etiqueta>
        <AreaTexto
          id="observaciones"
          name="observaciones"
          rows={2}
          placeholder="Contexto de la devolución en su conjunto."
        />
      </Tarjeta>

      <Tarjeta>
        <h2 className="titulo-seccion mb-3">
          Firma de entrega (quien devuelve){" "}
          <span className="text-fallo" aria-hidden="true">
            *
          </span>
        </h2>
        <FirmaCanvas name="firmaDevolucion" onCambio={setTieneFirma} />
      </Tarjeta>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      {conNovedad.length > 0 && sinExplicar.length === 0 && (
        <Aviso tono="espera">
          {conNovedad.length} ítem{conNovedad.length === 1 ? "" : "s"} vuelve
          {conNovedad.length === 1 ? "" : "n"} con novedad. Quedará registrado en el
          acta.
        </Aviso>
      )}

      <Boton
        type="submit"
        bloque
        disabled={!tieneFirma || sinExplicar.length > 0}
        textoPendiente="Registrando devolución…"
      >
        Registrar devolución
      </Boton>
    </form>
  );
}
