"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import {
  guardarFirmaPerfil,
  quitarFirmaPerfil,
  type EstadoPerfil,
} from "@/actions/perfil";
import FirmaCanvas from "@/components/firma-canvas";
import Boton from "@/components/ui/boton";
import { Aviso, Tarjeta } from "@/components/ui/superficie";

export default function FormularioFirma({
  firmaActual,
}: {
  firmaActual: string | null;
}) {
  const [estado, accion] = useActionState<EstadoPerfil, FormData>(
    guardarFirmaPerfil,
    {},
  );
  const [tieneFirma, setTieneFirma] = useState(false);
  const [quitando, iniciarQuitar] = useTransition();
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {firmaActual && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="titulo-seccion">Firma registrada</h2>
              <p className="mt-1 text-sm text-tinta-suave">
                Es la que aparece como «firma de quien entrega» en los
                documentos que emites.
              </p>
              <Image
                src={firmaActual}
                alt="Tu firma registrada"
                width={320}
                height={120}
                className="mt-3 h-24 w-auto rounded-lg border border-borde bg-panel-suave"
              />
            </div>
            <Boton
              type="button"
              variante="peligro"
              tamano="sm"
              disabled={quitando}
              onClick={() =>
                iniciarQuitar(async () => {
                  setErrorQuitar(null);
                  const r = await quitarFirmaPerfil();
                  if (r?.error) setErrorQuitar(r.error);
                })
              }
            >
              {quitando ? "Quitando…" : "Quitar firma"}
            </Boton>
          </div>
          {errorQuitar && (
            <Aviso tono="error" className="mt-3">
              {errorQuitar}
            </Aviso>
          )}
        </Tarjeta>
      )}

      <form action={accion} className="space-y-4">
        <Tarjeta>
          <h2 className="titulo-seccion">
            {firmaActual ? "Reemplazar la firma" : "Registrar tu firma"}
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Dibújala con el dedo o el mouse. Se guarda una sola vez y el sistema
            la estampa en cada acta que emitas, así no tienes que firmar a mano
            documento por documento.
          </p>
          <div className="mt-3">
            <FirmaCanvas name="firma" onCambio={setTieneFirma} />
          </div>
        </Tarjeta>

        {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

        <Boton
          type="submit"
          bloque
          disabled={!tieneFirma}
          textoPendiente="Guardando…"
        >
          {firmaActual ? "Reemplazar firma" : "Guardar firma"}
        </Boton>
      </form>
    </div>
  );
}
