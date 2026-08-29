import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ETIQUETA_ROL, ROLES_ADMIN } from "@/lib/solicitud-estado";
import { buscador } from "@/lib/busqueda";
import { Aviso, Vacio } from "@/components/ui/superficie";
import Buscador from "@/components/ui/buscador";
import Paginacion from "@/components/ui/paginacion";
import FormularioUsuario from "./formulario-usuario";
import ListaUsuarios from "./lista-usuarios";

export const metadata = { title: "Usuarios · Kontrol" };

const POR_PAGINA = 10;

export default async function AdminUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  // Administrar cuentas es exclusivo de ADMIN, más estricto que el layout de
  // la sección de configuración, que solo exige un rol de gestión.
  const actual = await requerirRol(...ROLES_ADMIN);

  const { page, q } = await searchParams;

  const [usuarios, brigadas, empresas] = await Promise.all([
    // Todas las cuentas y no una página: buscarlas sin tropezar con las tildes
    // —«perez» tiene que encontrar a «Pérez»— exige filtrarlas en JS, y la
    // paginación se aplica después sobre lo que quedó. Ver lib/busqueda.ts.
    db.usuario.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        brigada: { select: { nombre: true } },
        empresa: { select: { nombre: true } },
        empresasGestionadas: { select: { id: true } },
      },
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

  // Se busca por lo que identifica a una persona en la tabla: cómo se llama,
  // con qué entra, su RUT, y dónde está encasillada (rol, empresa, brigada).
  const coincide = buscador(q);
  const filtrados = usuarios.filter((u) =>
    coincide(
      u.nombre,
      u.username,
      u.rut,
      ETIQUETA_ROL[u.rol],
      u.empresa?.nombre,
      u.brigada?.nombre,
    ),
  );
  const buscando = Boolean(q?.trim());

  // La página se acota a las que existen tras filtrar: quien venía en la 4 y
  // busca un apellido que cabe en una no debe encontrarse una lista vacía.
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number(page) || 1), totalPaginas);
  const enPantalla = filtrados.slice(
    (pagina - 1) * POR_PAGINA,
    pagina * POR_PAGINA,
  );

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

      <Buscador
        etiqueta="Buscar cuenta"
        placeholder="Nombre, usuario, RUT, empresa o brigada…"
        valor={q ?? ""}
        accion="/configuracion/usuarios"
        resumen={
          buscando ? `${filtrados.length} de ${usuarios.length} cuentas` : undefined
        }
      />

      {enPantalla.length === 0 ? (
        <Vacio mensaje="Ninguna cuenta coincide con esa búsqueda. Prueba con parte del nombre, el usuario o el RUT." />
      ) : (
        <ListaUsuarios
          idActual={actual.id}
          empresas={empresas}
          brigadas={brigadas.map((b) => ({
            id: b.id,
            nombre: b.nombre,
            empresaId: b.empresaId,
            miembros: b._count.miembros,
          }))}
          usuarios={enPantalla.map((u) => ({
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
      )}

      <Paginacion
        paginaActual={pagina}
        totalPaginas={totalPaginas}
        href={(p) =>
          `/configuracion/usuarios?${new URLSearchParams({
            ...(q ? { q } : {}),
            page: String(p),
          })}`
        }
      />
    </div>
  );
}
