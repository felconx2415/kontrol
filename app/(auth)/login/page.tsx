import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import FormularioLogin from "./formulario-login";

export const metadata = { title: "Ingresar · Kontrol" };

export default async function PaginaLogin() {
  if (await usuarioActual()) redirect("/escritorio");

  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      {/* Panel de marca: da identidad y explica qué es Kontrol antes de entrar. */}
      <aside className="flex flex-col justify-between bg-marca-950 px-8 py-10 text-white lg:w-[42%] lg:px-12 lg:py-14">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-marca-950">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">Kontrol</span>
        </div>

        <div className="my-10 max-w-md lg:my-0">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance lg:text-4xl">
            Cada entrega, con nombre y firma.
          </h1>
          <p className="mt-4 text-marca-200">
            Solicitudes de equipamiento y EPP para brigadas: quién lo pidió,
            quién lo aprobó y quién lo recibió. Sin planillas sueltas.
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-4 border-t border-white/15 pt-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-marca-200">Solicita</dt>
            <dd className="mt-0.5 font-medium">Nuevo o reemplazo</dd>
          </div>
          <div>
            <dt className="text-marca-200">Aprueba</dt>
            <dd className="mt-0.5 font-medium">Con trazabilidad</dd>
          </div>
          <div>
            <dt className="text-marca-200">Entrega</dt>
            <dd className="mt-0.5 font-medium">Firma y acta</dd>
          </div>
        </dl>
      </aside>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="titulo-pagina">Ingresa a tu cuenta</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Usa el usuario que te entregó el encargado de bodega.
          </p>

          <div className="mt-8">
            <FormularioLogin />
          </div>

          <p className="mt-8 text-xs text-tinta-tenue">
            ¿Sin cuenta? Solicítala al encargado de bodega.
          </p>
        </div>
      </div>
    </main>
  );
}
