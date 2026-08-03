import Image from "next/image";
import Link from "next/link";
import { verificarDocumento } from "@/lib/verificacion";
import { formatearFechaHora } from "@/lib/vencimientos";
import PieSitio from "@/components/pie-sitio";

export const metadata = { title: "Verificación de documento · Kontrol" };

/**
 * Página a la que apunta el QR de cada acta. Es pública y deliberadamente
 * escueta: confirma que el documento existe y está firmado, sin revelar de
 * quién es ni qué se le entregó (ver lib/verificacion.ts).
 */
export default async function VerificarDocumento({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const documento = await verificarDocumento(decodeURIComponent(codigo));

  return (
    <div className="flex min-h-dvh flex-col">
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <Link href="/" className="foco-anillo mx-auto mb-8 rounded">
        <Image
          src="/logo-kontrol-oscuro.png"
          alt="Kontrol"
          width={600}
          height={148}
          priority
          className="h-7 w-auto"
        />
      </Link>

      {documento ? (
        <section className="rounded-xl border border-exito-borde bg-exito-fondo p-5">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 20 20"
              className="size-5 shrink-0 fill-exito"
              aria-hidden="true"
            >
              <path d="M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0Zm4.7 7.7-5.4 5.4a1 1 0 0 1-1.4 0L5.3 10.5l1.4-1.4 1.9 1.9 4.7-4.7 1.4 1.4Z" />
            </svg>
            <h1 className="text-base font-semibold text-exito">
              Documento válido
            </h1>
          </div>

          <p className="mt-2 text-sm text-tinta">
            {documento.etiquetaTipo} emitida por Kontrol.
          </p>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-tinta-suave">Número</dt>
            <dd className="font-mono font-medium tabular-nums">{documento.numero}</dd>

            <dt className="text-tinta-suave">Emitida</dt>
            <dd>{formatearFechaHora(documento.emitidoEn)}</dd>

            <dt className="text-tinta-suave">Ítems</dt>
            <dd>{documento.totalItems}</dd>

            <dt className="text-tinta-suave">Firma</dt>
            <dd>{documento.firmado ? "Registrada" : "Sin registrar"}</dd>

            {documento.nota && (
              <>
                <dt className="text-tinta-suave">Estado</dt>
                <dd>{documento.nota}</dd>
              </>
            )}
          </dl>

          <p className="mt-4 border-t border-exito-borde pt-3 text-xs text-tinta-suave">
            Por privacidad, esta página no muestra a quién se entregó el
            material ni su detalle. Esos datos están en el documento impreso y
            en la cuenta de la persona.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-fallo-borde bg-fallo-fondo p-5">
          <h1 className="text-base font-semibold text-fallo">
            No encontramos este documento
          </h1>
          <p className="mt-2 text-sm text-tinta">
            El código no corresponde a ningún acta emitida por Kontrol. Puede
            estar mal escrito, o el documento haber sido anulado.
          </p>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-tinta-tenue">
        Kontrol · gestión de equipamiento y EPP
      </p>
    </main>

    <PieSitio />
    </div>
  );
}
