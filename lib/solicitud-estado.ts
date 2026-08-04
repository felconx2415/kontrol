import type {
  Categoria,
  EstadoSolicitud,
  Motivo,
  Rol,
  TipoBrigada,
} from "@/generated/prisma/enums";

/**
 * Única fuente de verdad del ciclo de vida de una solicitud.
 * La usan tanto la UI (para decidir qué botones mostrar) como las Server
 * Actions (para validar antes de escribir). No duplicar estas reglas.
 */

/**
 * Roles con acceso a la operación completa del sitio (logística, reportes,
 * catálogo). ADMIN incluye todo lo de GESTOR.
 */
export const ROLES_GESTION: Rol[] = ["GESTOR", "ADMIN"];

/** Solo ADMIN administra cuentas de usuario. */
export const ROLES_ADMIN: Rol[] = ["ADMIN"];

export const esGestion = (rol: Rol) => ROLES_GESTION.includes(rol);
export const esAdmin = (rol: Rol) => ROLES_ADMIN.includes(rol);

type Transicion = {
  desde: EstadoSolicitud;
  hacia: EstadoSolicitud;
  roles: Rol[];
  /** Etiqueta del botón que dispara la transición. */
  accion: string;
};

export const TRANSICIONES: Transicion[] = [
  { desde: "BORRADOR", hacia: "PENDIENTE", roles: ["SOLICITANTE", "APROBADOR", "GESTOR", "ADMIN"], accion: "Enviar solicitud" },
  { desde: "PENDIENTE", hacia: "APROBADA", roles: ["APROBADOR", "GESTOR", "ADMIN"], accion: "Aprobar" },
  { desde: "PENDIENTE", hacia: "RECHAZADA", roles: ["APROBADOR", "GESTOR", "ADMIN"], accion: "Rechazar" },
  // Dos caminos hacia el almacén, según qué se pida. En EPP hay que pedir el
  // número de reserva y esperar a que lo entreguen (RESERVA_SOLICITADA); en
  // equipamiento el gestor crea la reserva él mismo y pasa directo.
  { desde: "APROBADA", hacia: "RESERVA_SOLICITADA", roles: ["GESTOR", "ADMIN"], accion: "Solicitar reserva" },
  { desde: "APROBADA", hacia: "EN_GESTION", roles: ["GESTOR", "ADMIN"], accion: "Registrar reserva y gestionar" },
  { desde: "RESERVA_SOLICITADA", hacia: "EN_GESTION", roles: ["GESTOR", "ADMIN"], accion: "Registrar reserva y gestionar" },
  // El beneficiario cierra su propio ciclo: a veces retira el material él mismo
  // en el almacén, y obligar a que gestión confirme y entregue algo que ya está
  // en sus manos solo dejaba solicitudes abiertas por trámite. Sobre las suyas
  // y solo las suyas: la propiedad se valida en cada Server Action.
  { desde: "EN_GESTION", hacia: "RECIBIDA", roles: ["SOLICITANTE", "GESTOR", "ADMIN"], accion: "Marcar recibida" },
  { desde: "RECIBIDA", hacia: "ENTREGADA", roles: ["SOLICITANTE", "GESTOR", "ADMIN"], accion: "Entregar y firmar" },
  { desde: "BORRADOR", hacia: "CANCELADA", roles: ["SOLICITANTE", "APROBADOR", "GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "PENDIENTE", hacia: "CANCELADA", roles: ["SOLICITANTE", "APROBADOR", "GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "APROBADA", hacia: "CANCELADA", roles: ["APROBADOR", "GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "RESERVA_SOLICITADA", hacia: "CANCELADA", roles: ["GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "EN_GESTION", hacia: "CANCELADA", roles: ["GESTOR", "ADMIN"], accion: "Cancelar" },
  { desde: "RECIBIDA", hacia: "CANCELADA", roles: ["GESTOR", "ADMIN"], accion: "Cancelar" },
];

/** Estados finales: ya no admiten ninguna transición. */
export const ESTADOS_FINALES: EstadoSolicitud[] = ["ENTREGADA", "RECHAZADA", "CANCELADA"];

export function puedeTransicionar(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud,
  rol: Rol,
): boolean {
  return TRANSICIONES.some(
    (t) => t.desde === desde && t.hacia === hacia && t.roles.includes(rol),
  );
}

/**
 * Si este usuario puede actuar sobre esta solicitud.
 *
 * El rol dice qué acciones existen; esto, sobre cuáles. Un solicitante solo
 * toca lo suyo —ahora que además recibe y firma, esa frontera es lo único que
 * separa cerrar el propio pedido de cerrar el de otro—, y gestión toca
 * cualquiera. Va aquí, junto a las transiciones, para que ninguna Server Action
 * nueva se olvide de comprobarlo.
 */
export function puedeActuarSobre(
  usuario: { id: string; rol: Rol },
  solicitud: { solicitanteId: string },
): boolean {
  return usuario.rol !== "SOLICITANTE" || solicitud.solicitanteId === usuario.id;
}

/** Transiciones disponibles para un rol desde el estado actual. */
export function accionesDisponibles(
  estado: EstadoSolicitud,
  rol: Rol,
): Transicion[] {
  return TRANSICIONES.filter((t) => t.desde === estado && t.roles.includes(rol));
}

export const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  RESERVA_SOLICITADA: "Reserva solicitada",
  EN_GESTION: "En gestión con el almacén",
  RECIBIDA: "Recibida en bodega",
  ENTREGADA: "Entregada",
  CANCELADA: "Cancelada",
};

/**
 * Color por estado, reducido a cinco matices en vez de siete.
 *
 * Los estados intermedios (aprobada, reserva solicitada, en gestión, recibida)
 * comparten el color de marca: el avance por el flujo se lee como "progresando"
 * y solo los desenlaces tienen color propio. Antes cada uno usaba un matiz
 * distinto (sky/violet/indigo) que no aportaba significado distinguible.
 */
export const COLOR_ESTADO: Record<EstadoSolicitud, string> = {
  BORRADOR: "bg-lienzo text-tinta-suave ring-borde-fuerte",
  PENDIENTE: "bg-espera-fondo text-espera ring-espera-borde",
  APROBADA: "bg-marca-50 text-marca-700 ring-marca-200",
  RESERVA_SOLICITADA: "bg-marca-50 text-marca-700 ring-marca-200",
  EN_GESTION: "bg-marca-50 text-marca-700 ring-marca-200",
  RECIBIDA: "bg-marca-50 text-marca-700 ring-marca-200",
  ENTREGADA: "bg-exito-fondo text-exito ring-exito-borde",
  RECHAZADA: "bg-fallo-fondo text-fallo ring-fallo-borde",
  CANCELADA: "bg-lienzo text-tinta-tenue ring-borde",
};

/**
 * Tope de beneficiarios en un envío múltiple: una brigada entera cabe de
 * sobra. Vive aquí y no en la Server Action porque un archivo "use server"
 * solo puede exportar funciones async.
 */
export const MAXIMO_BENEFICIARIOS = 50;

/**
 * Avance normal de una solicitud, en orden. Existe para poder decirle al
 * beneficiario «paso 3 de 5» en vez de obligarlo a interpretar el nombre del
 * estado. Los desenlaces negativos no son etapas: cortan el flujo en vez de
 * avanzarlo, y BORRADOR queda fuera porque todavía no empieza el trámite.
 */
export const ETAPAS_FLUJO: EstadoSolicitud[] = [
  "PENDIENTE",
  "APROBADA",
  "RESERVA_SOLICITADA",
  "EN_GESTION",
  "RECIBIDA",
  "ENTREGADA",
];

/**
 * Qué está pasando ahora, en las palabras de quien espera el equipamiento y no
 * conoce el proceso interno. ETIQUETA_ESTADO nombra el estado; esto explica qué
 * significa para él y quién tiene la pelota.
 */
export const ESPERA_DEL_SOLICITANTE: Record<EstadoSolicitud, string> = {
  BORRADOR: "Todavía sin enviar.",
  PENDIENTE: "A la espera de que la aprueben.",
  APROBADA: "Aprobada. Falta que se pida al almacén.",
  RESERVA_SOLICITADA: "Se pidió el número de reserva al almacén.",
  EN_GESTION: "Pedida al almacén: el material viene en camino.",
  RECIBIDA: "El material ya llegó a bodega. Te citarán para entregártelo.",
  ENTREGADA: "Entregada y firmada.",
  RECHAZADA: "No fue aprobada.",
  CANCELADA: "Se canceló antes de completarse.",
};

export type PasoSolicitud = {
  /** Posición en ETAPAS_FLUJO, 1-indexada. 0 si el flujo no avanzó por ahí. */
  paso: number;
  total: number;
  /** El flujo llegó a su fin natural. */
  completado: boolean;
  /** Rechazada o cancelada: el avance se cortó y ya no continúa. */
  interrumpido: boolean;
};

export function pasoDeSolicitud(estado: EstadoSolicitud): PasoSolicitud {
  const indice = ETAPAS_FLUJO.indexOf(estado);
  return {
    paso: indice + 1, // -1 + 1 = 0 para los estados fuera del avance
    total: ETAPAS_FLUJO.length,
    completado: estado === "ENTREGADA",
    interrumpido: estado === "RECHAZADA" || estado === "CANCELADA",
  };
}

// ── Reserva del almacén externo ───────────────────────────────────────────

/**
 * De qué centro de costo sale el material define cómo se consigue la reserva, y
 * eso —no la categoría del artículo— es lo que separa los dos trámites:
 *
 * - `CECO_ALMACEN`: la reserva la entrega el almacén. Hay que pedirla y esperar
 *   (estado RESERVA_SOLICITADA), y viene sin posición. Es la única que entra en
 *   la planilla que se le manda al almacén.
 * - `CECO_RESERVA_PROPIA`: la reserva la crea el gestor, así que no hay espera,
 *   y cada línea lleva su posición dentro de ella.
 *
 * Una línea de cualquier otro CECO va por otro canal y no lleva reserva.
 */
export const CECO_ALMACEN = "FD1400D082";
export const CECO_RESERVA_PROPIA = "200/IM136";

/** Una línea de solicitud, en lo que necesita el trámite de reserva. */
export type LineaReserva = {
  id: string;
  ceco: string | null;
  numeroReserva?: string | null;
  posicionReserva?: string | null;
};

/** Las líneas que se piden al almacén interno; son las que van en la planilla. */
export function lineasDeAlmacen<T extends { ceco: string | null }>(items: T[]): T[] {
  return items.filter((i) => i.ceco === CECO_ALMACEN);
}

/** Todas las líneas que llevan reserva, de cualquiera de los dos orígenes. */
export function lineasConReserva<T extends { ceco: string | null }>(items: T[]): T[] {
  return items.filter(
    (i) => i.ceco === CECO_ALMACEN || i.ceco === CECO_RESERVA_PROPIA,
  );
}

/** La posición solo existe en la reserva que crea el propio gestor. */
export function llevaPosicion(ceco: string | null): boolean {
  return ceco === CECO_RESERVA_PROPIA;
}

/**
 * Posiciones correlativas de una reserva: «0010», «0020», «0030»…
 *
 * Es la numeración que usa el almacén para las líneas de una misma reserva, y
 * se reparte a lo largo de todo un lote cuando varias solicitudes comparten
 * reserva.
 */
export function posicionesSecuenciales(
  cantidad: number,
  inicio = 10,
  paso = 10,
): string[] {
  return Array.from({ length: cantidad }, (_, i) =>
    String(inicio + i * paso).padStart(4, "0"),
  );
}

/**
 * Qué falta para poder gestionar con el almacén. Devuelve el mensaje de error o
 * null si está todo.
 *
 * Sin número de reserva no hay nada que gestionar, así que se exige en toda
 * línea que lleve reserva. La posición se exige solo donde existe: en la
 * reserva que crea el gestor. La del almacén llega sin posición.
 */
export function faltaReserva(items: LineaReserva[]): string | null {
  const lineas = lineasConReserva(items);
  if (lineas.length === 0) return null;

  if (lineas.some((i) => !i.numeroReserva?.trim())) {
    return "Falta el número de reserva en alguna línea del pedido.";
  }

  if (lineas.some((i) => llevaPosicion(i.ceco) && !i.posicionReserva?.trim())) {
    return `Las líneas del CECO ${CECO_RESERVA_PROPIA} necesitan su posición dentro de la reserva.`;
  }

  return null;
}

/**
 * Las reservas en juego, agrupadas por CECO, para mostrarlas de un vistazo. Una
 * solicitud que mezcla los dos orígenes se gestiona con dos reservas distintas.
 */
export function reservasPorCeco(
  items: LineaReserva[],
): { ceco: string; numeros: string[] }[] {
  const porCeco = new Map<string, Set<string>>();

  for (const item of lineasConReserva(items)) {
    const numero = item.numeroReserva?.trim();
    if (!numero || !item.ceco) continue;
    const actual = porCeco.get(item.ceco) ?? new Set<string>();
    actual.add(numero);
    porCeco.set(item.ceco, actual);
  }

  return [...porCeco].map(([ceco, numeros]) => ({ ceco, numeros: [...numeros] }));
}

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  EPP: "EPP",
  EQUIPAMIENTO: "Equipamiento",
};

export const ETIQUETA_MOTIVO: Record<Motivo, string> = {
  DESGASTE: "Desgaste por uso",
  EXTRAVIO: "Extraviado (a)",
  HURTO_MOVIL: "Hurto desde el móvil",
  PERDIDA_SINIESTRO: "Pérdida por siniestro",
  ROBO_MOVIL: "Robo de móvil",
  VENCIMIENTO_CERT: "Vencida certificación",
  NUEVA_INCORPORACION: "Nueva incorporación",
  PRIMERA_VEZ: "Solicitado por primera vez",
  STOCK_FRONTEL: "Stock Frontel",
};

/**
 * Motivos disponibles según el tipo de solicitud. Un reemplazo justifica por
 * qué se cambia algo que ya se tenía; una solicitud nueva, por qué se pide algo
 * por primera vez. Se envía como columna «Estado» al almacén.
 */
export const MOTIVOS_REEMPLAZO: Motivo[] = [
  "DESGASTE",
  "EXTRAVIO",
  "HURTO_MOVIL",
  "PERDIDA_SINIESTRO",
  "ROBO_MOVIL",
  "VENCIMIENTO_CERT",
];

export const MOTIVOS_NUEVO: Motivo[] = [
  "NUEVA_INCORPORACION",
  "PRIMERA_VEZ",
  "STOCK_FRONTEL",
];

/** Motivos válidos para un tipo de solicitud dado. */
export function motivosDe(tipo: "NUEVO" | "REEMPLAZO"): Motivo[] {
  return tipo === "REEMPLAZO" ? MOTIVOS_REEMPLAZO : MOTIVOS_NUEVO;
}

export const ETIQUETA_TIPO_BRIGADA: Record<TipoBrigada, string> = {
  EMPRESA: "Empresa",
  CONTRATISTA: "Contratista",
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  SOLICITANTE: "Solicitante",
  APROBADOR: "Aprobador",
  GESTOR: "Gestor",
  ADMIN: "Administrador",
};

/**
 * Todos los roles asignables, en orden de menor a mayor alcance. Se deriva de
 * ETIQUETA_ROL (un Record<Rol, string>) para que añadir un rol al enum sin
 * actualizar esta lista sea imposible.
 */
export const ROLES = Object.keys(ETIQUETA_ROL) as Rol[];
