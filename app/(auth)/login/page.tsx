import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import FormularioLogin from "./formulario-login";

export const metadata = { title: "Ingresar · Kontrol" };

export default async function PaginaLogin() {
  if (await usuarioActual()) redirect("/escritorio");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-marca-950 text-sm font-bold text-white">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">Kontrol</span>
        </div>

        <h2 className="titulo-pagina mt-10">Ingresa a tu cuenta</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Usa el usuario que te entregó el encargado de bodega.
        </p>

        <div className="mt-8">
          <FormularioLogin />
        </div>
      </div>
    </main>
  );
}
