"use client";

import { useActionState, useState } from "react";
import { devolverPrestamo, type EstadoBodega } from "@/actions/bodega";
import FirmaCanvas from "@/components/firma-canvas";
import SubirFotos from "@/components/subir-fotos";
import Boton from "@/components/ui/boton";
import { AreaTexto, Etiqueta } from "@/components/ui/campo";
import { Aviso, Tarjeta } from "@/components/ui/superficie";

export default function FormularioDevolucion({
  prestamoId,
}: {
  prestamoId: string;
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    devolverPrestamo,
    {},
  );
  const [tieneFirma, setTieneFirma] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="prestamoId" value={prestamoId} />
      <input type="hidden" name="fotos" value={JSON.stringify(fotos)} />

      <Tarjeta>
        <Etiqueta htmlFor="observaciones">Observaciones (opcional)</Etiqueta>
        <AreaTexto
          id="observaciones"
          name="observaciones"
          rows={2}
          placeholder="Ej: vuelve con la carcasa rajada."
        />
      </Tarjeta>

      <Tarjeta>
        <SubirFotos valor={fotos} onCambio={setFotos} />
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

      <Boton
        type="submit"
        bloque
        disabled={!tieneFirma}
        textoPendiente="Registrando devolución…"
      >
        Registrar devolución
      </Boton>
    </form>
  );
}
