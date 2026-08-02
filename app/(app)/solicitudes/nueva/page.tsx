import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { esGestion } from "@/lib/solicitud-estado";
import FormularioSolicitud, { type Asignado } from "./formulario-solicitud";

export const metadata = { title: "Nueva solicitud · Kontrol" };

export default async function NuevaSolicitud({
  searchParams,
}: {
  searchParams: Promise<{ para?: string }>;
}) {
  const usuario = await requerirUsuario();
  const { para } = await searchParams;

  // Gestión puede pedir a nombre de otros. Quiénes son viaja en la URL y no en
  // el estado del formulario porque de cada persona depende qué puede
  // reemplazar, y eso se consulta aquí, en el servidor.
  const puedeElegirPersona = esGestion(usuario.rol);

  const personas = puedeElegirPersona
    ? await db.usuario.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
        select: {
          id: true,
          nombre: true,
          rut: true,
          brigada: { select: { nombre: true } },
        },
      })
    : [];

  // `para` es una lista separada por comas: se puede cargar equipamiento para
  // varias personas en un mismo envío. Un id inválido (o de alguien sin permiso
  // para usarlo) se descarta en silencio en vez de romper la página.
  const idsPedidos = (para ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // El orden lo manda la URL: es el orden en que se fueron agregando.
  const porId = new Map(personas.map((p) => [p.id, p]));
  const beneficiarios = idsPedidos
    .map((id) => porId.get(id))
    .filter((p): p is (typeof personas)[number] => Boolean(p));

  const esParaMi = beneficiarios.length === 0;

  const articulos = await db.articulo.findMany({
    where: { activo: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });

  // Ítems que cada persona tiene asignados y aún no han sido reemplazados: son
  // los candidatos válidos de una solicitud de reemplazo. Se piden todos de una
  // vez y se agrupan por dueño, porque cada carga del envío tiene los suyos.
  const receptores = esParaMi ? [usuario.id] : beneficiarios.map((b) => b.id);

  const entregados = await db.entregaItem.findMany({
    where: {
      reemplazadoEn: null,
      reemplazadoPor: null,
      entrega: { receptorId: { in: receptores } },
    },
    orderBy: { entrega: { entregadaEn: "desc" } },
    include: {
      entrega: { select: { entregadaEn: true, receptorId: true } },
      solicitudItem: {
        include: { articulo: { select: { id: true, nombre: true, codigo: true } } },
      },
    },
  });

  const asignadosPorPersona: Record<string, Asignado[]> = {};
  for (const id of receptores) asignadosPorPersona[id] = [];
  for (const i of entregados) {
    asignadosPorPersona[i.entrega.receptorId]?.push({
      entregaItemId: i.id,
      articuloId: i.solicitudItem.articulo.id,
      articuloNombre: i.solicitudItem.articulo.nombre,
      entregadoEn: i.entrega.entregadaEn.toISOString(),
    });
  }

  const conDetalle = (p: (typeof personas)[number]) => ({
    id: p.id,
    nombre: p.nombre,
    detalle: [p.brigada?.nombre, p.rut].filter(Boolean).join(" · ") || "Sin brigada",
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/solicitudes"
          className="foco-anillo -ml-1 inline-flex min-h-11 items-center rounded px-1 text-sm text-tinta-tenue transition-colors duration-150 hover:text-tinta"
        >
          ← Volver a solicitudes
        </Link>
        <h1 className="titulo-pagina mt-2">Nueva solicitud</h1>
        <p className="text-sm text-tinta-suave">
          {puedeElegirPersona
            ? "Pide para ti o carga el equipamiento de una o varias personas; cada una lleva lo suyo."
            : "Pide equipamiento o EPP nuevo, o el reemplazo de algo que ya tienes."}
        </p>
      </div>

      <FormularioSolicitud
        articulos={articulos.map((a) => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          categoria: a.categoria,
        }))}
        asignadosPorPersona={asignadosPorPersona}
        personas={personas.map(conDetalle)}
        beneficiarios={beneficiarios.map(conDetalle)}
        miId={usuario.id}
        miNombre={usuario.nombre}
      />
    </div>
  );
}
