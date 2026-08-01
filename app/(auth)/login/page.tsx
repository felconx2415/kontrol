import Image from "next/image";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import FormularioLogin from "./formulario-login";

export const metadata = { title: "Ingresar · Kontrol" };

export default async function PaginaLogin() {
  if (await usuarioActual()) redirect("/escritorio");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Fondo claro: aquí va la variante con la palabra en marca-950; la
            del sitio interno la lleva en blanco para la píldora oscura. */}
        <Image
          src="/logo-kontrol-oscuro.png"
          alt="Kontrol"
          width={600}
          height={148}
          priority
          className="h-8 w-auto"
        />

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
