import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { DESCRIPCION_AREA, destinosDeGrupo } from "@/lib/navegacion";
import { Icono } from "@/components/nav-principal";

export const metadata = { title: "Configuración · Kontrol" };

export default async function PaginaConfiguracion() {
  const usuario = await requerirRol(...ROLES_GESTION);

  const areas = destinosDeGrupo(usuario, "configuracion");

  // Cuánto hay en cada área. El número no es adorno: dice si algo está sin
  // configurar antes de entrar a mirarlo —una empresa sin brigadas, un catálogo
  // vacío— y por eso el índice existe en vez de ser cuatro enlaces.
  const [articulos, usuarios, brigadas, empresas] = await Promise.all([
    db.articulo.count({ where: { activo: true } }),
    db.usuario.count({ where: { activo: true } }),
    db.brigada.count(),
    db.empresa.count({ where: { activa: true } }),
  ]);

  const CONTEO: Record<string, { valor: number; unidad: [string, string] }> = {
    catalogo: { valor: articulos, unidad: ["artículo activo", "artículos activos"] },
    usuarios: { valor: usuarios, unidad: ["cuenta activa", "cuentas activas"] },
    brigadas: { valor: brigadas, unidad: ["brigada", "brigadas"] },
    empresas: { valor: empresas, unidad: ["empresa activa", "empresas activas"] },
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="titulo-pagina">Configuración</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Lo que se define una vez y después solo se consulta: qué se puede
          pedir, quién lo pide y a qué empresa pertenece.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {areas.map((area) => {
          const conteo = CONTEO[area.id];
          const plural = conteo && conteo.valor !== 1;

          return (
            <li key={area.id}>
              <Link
                href={area.href}
                className="foco-anillo group flex h-full items-start gap-3 rounded-xl border border-borde bg-panel p-4 transition-colors duration-150 hover:border-marca-200 hover:bg-marca-50"
              >
                <span className="mt-0.5 shrink-0 text-marca-600">
                  <Icono nombre={area.icono} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-tinta group-hover:underline">
                    {area.texto}
                  </span>
                  <span className="mt-0.5 block text-sm text-tinta-suave">
                    {DESCRIPCION_AREA[area.id]}
                  </span>
                  {conteo && (
                    <span className="mt-1.5 block text-xs tabular-nums text-tinta-tenue">
                      {conteo.valor} {conteo.unidad[plural ? 1 : 0]}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
