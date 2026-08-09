import type { Rol } from "@/generated/prisma/enums";

/**
 * Hasta dónde llega lo que una persona puede ver.
 *
 * La empresa es la frontera del sistema: quien pertenece a una no ve lo de las
 * otras. Hay dos excepciones, y por eso esto no es un simple `empresaId`:
 *
 * - El **ADMIN** administra el sistema entero y no se circunscribe a ninguna
 *   empresa (`todas`).
 * - El **gestor** puede atender varias a la vez —la misma persona lleva la
 *   logística de dos contratistas—, así que su alcance es una lista.
 *
 * Todo listado que cruce personas tiene que pasar por aquí. Los datos propios
 * (lo que yo pedí, lo que a mí me entregaron) no se filtran por empresa: se
 * filtran por usuario, y eso es más estrecho todavía.
 */
export type Alcance =
  /** Sin límite: administra el sistema. */
  | { todas: true }
  /** Las empresas concretas que alcanza; vacío significa ninguna. */
  | { todas: false; empresas: string[] };

export const ALCANCE_TOTAL: Alcance = { todas: true };

/**
 * Alcance de una cuenta según su rol.
 *
 * Un gestor sin ninguna empresa asignada cae en su empresa de origen en vez de
 * quedarse a ciegas: es la configuración que tenía antes de poder llevar
 * varias, y estrenar la separación dejando a alguien sin nada que ver sería un
 * corte de acceso disfrazado de migración.
 */
export function alcanceDe(usuario: {
  rol: Rol;
  empresaId: string | null;
  empresasGestionadas?: { id: string }[];
}): Alcance {
  // Se compara con el rol directamente en vez de usar `esAdmin`: este módulo
  // no puede importar lib/solicitud-estado.ts, que a su vez lo importa a él
  // para resolver sobre qué solicitudes se puede actuar.
  if (usuario.rol === "ADMIN") return ALCANCE_TOTAL;

  if (usuario.rol === "GESTOR") {
    const asignadas = (usuario.empresasGestionadas ?? []).map((e) => e.id);
    if (asignadas.length > 0) return { todas: false, empresas: asignadas };
  }

  return {
    todas: false,
    empresas: usuario.empresaId ? [usuario.empresaId] : [],
  };
}

/**
 * Fragmento `where` de Prisma para restringir a las empresas del alcance.
 *
 * Se combina con el resto del filtro por composición (`{ ...filtro, ...otros }`)
 * en cualquier modelo que tenga `empresaId`.
 *
 * Los registros sin empresa quedan fuera para todos menos el ADMIN: son datos
 * de antes de la separación o mal configurados, y mostrárselos a una empresa
 * cualquiera sería justo la fuga que esto viene a cerrar.
 */
export function filtroEmpresa(alcance: Alcance): { empresaId?: { in: string[] } } {
  if (alcance.todas) return {};
  return { empresaId: { in: alcance.empresas } };
}

/**
 * Igual que `filtroEmpresa`, pero para consultar el propio modelo Empresa,
 * donde la empresa se identifica por `id` y no por `empresaId`.
 */
export function filtroEmpresaPropia(alcance: Alcance): { id?: { in: string[] } } {
  if (alcance.todas) return {};
  return { id: { in: alcance.empresas } };
}

/** Si el alcance cubre una empresa concreta. `null` = registro sin empresa. */
export function alcanza(alcance: Alcance, empresaId: string | null): boolean {
  if (alcance.todas) return true;
  if (!empresaId) return false;
  return alcance.empresas.includes(empresaId);
}

/**
 * La empresa que se asume al crear algo (bodega, brigada) cuando el alcance
 * cubre una sola. Con varias no hay una obvia y hay que preguntarla; con
 * ninguna, no se puede crear nada.
 */
export function empresaPorDefecto(alcance: Alcance): string | null {
  if (alcance.todas) return null;
  return alcance.empresas.length === 1 ? alcance.empresas[0] : null;
}

/**
 * A qué empresa va algo que se está creando, validado contra el alcance.
 *
 * Quien alcanza una sola no elige: se asume la suya y el formulario ni siquiera
 * pregunta. Quien alcanza varias —un gestor de dos contratistas, el ADMIN—
 * tiene que decir cuál, porque no hay una obvia y adivinarla dejaría el
 * material en la bodega equivocada.
 */
export function empresaParaCrear(
  alcance: Alcance,
  pedida: string | null | undefined,
): { empresaId: string; error?: undefined } | { empresaId?: undefined; error: string } {
  const elegida = pedida?.trim() || empresaPorDefecto(alcance);

  if (!elegida) {
    return {
      error: sinEmpresa(alcance)
        ? MENSAJE_SIN_EMPRESA
        : "Indica a qué empresa pertenece.",
    };
  }
  if (!alcanza(alcance, elegida)) {
    return { error: "Esa empresa no está entre las que gestionas." };
  }
  return { empresaId: elegida };
}

/** Nadie que no sea ADMIN puede operar sin al menos una empresa asignada. */
export function sinEmpresa(alcance: Alcance): boolean {
  return !alcance.todas && alcance.empresas.length === 0;
}

export const MENSAJE_SIN_EMPRESA =
  "Tu cuenta todavía no está asignada a ninguna empresa. Pídele a un administrador que te asigne una para poder trabajar.";
