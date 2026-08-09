import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_ADMIN } from "@/lib/solicitud-estado";
import { Aviso } from "@/components/ui/superficie";
import Paginacion from "@/components/ui/paginacion";
import FormularioUsuario from "./formulario-usuario";
import ListaUsuarios from "./lista-usuarios";

export const metadata = { title: "Usuarios · Kontrol" };

const POR_PAGINA = 10;

export default async function AdminUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Administrar cuentas es exclusivo de ADMIN, más estricto que el layout de
  // la sección de configuración, que solo exige un rol de gestión.
  const actual = await requerirRol(...ROLES_ADMIN);

  const { page } = await searchParams;
  const pagina = Math.max(1, Number(page) || 1);

  const [total, usuarios, brigadas, empresas] = await Promise.all([
    db.usuario.count(),
    db.usuario.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        brigada: { select: { nombre: true } },
        empresa: { select: { nombre: true } },
        empresasGestionadas: { select: { id: true } },
      },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    // Todas las brigadas, con su empresa: el formulario filtra en el cliente
    // según la empresa elegida, sin ir y volver al servidor en cada cambio.
    // Con cuántos miembros cuenta cada una: es lo que permite avisar, antes de
    // confirmar, si una brigada se muda entera o si alguien va a quedarse sin
    // ella. Ver `avisoBrigadas` en lista-usuarios.tsx.
    db.brigada.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        empresaId: true,
        _count: { select: { miembros: true } },
      },
    }),
    db.empresa.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, activa: true },
    }),
  ]);
  const totalPaginas = Math.ceil(total / POR_PAGINA);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Usuarios</h1>
        <p className="text-sm text-tinta-suave">
          Crea cuentas, edita sus datos, restablece contraseñas y controla el
          acceso al sistema.
        </p>
      </div>

      {empresas.some((e) => e.activa) ? (
        <FormularioUsuario brigadas={brigadas} empresas={empresas} />
      ) : (
        <Aviso tono="espera">
          Antes de crear cuentas necesitas al menos una empresa activa: cada
          persona pertenece a una. Crea la primera en{" "}
          <Link href="/configuracion/empresas" className="underline underline-offset-2">
            Empresas
          </Link>
          .
        </Aviso>
      )}

      <ListaUsuarios
        idActual={actual.id}
        empresas={empresas}
        brigadas={brigadas.map((b) => ({
          id: b.id,
          nombre: b.nombre,
          empresaId: b.empresaId,
          miembros: b._count.miembros,
        }))}
        usuarios={usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          username: u.username,
          rut: u.rut,
          rol: u.rol,
          brigadaId: u.brigadaId,
          brigadaNombre: u.brigada?.nombre ?? null,
          empresaId: u.empresaId,
          empresaNombre: u.empresa?.nombre ?? null,
          empresasGestionadas: u.empresasGestionadas.map((e) => e.id),
          activo: u.activo,
        }))}
      />

      <Paginacion
        paginaActual={pagina}
        totalPaginas={totalPaginas}
        href={(p) => `/configuracion/usuarios?page=${p}`}
      />
    </div>
  );
}
