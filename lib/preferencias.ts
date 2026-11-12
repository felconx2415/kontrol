/**
 * Preferencias de interfaz que se guardan en cookie para que el servidor las
 * lea al pintar (y la página no salte al hidratar).
 *
 * Viven aquí y no junto al componente que las usa: un módulo "use client" no
 * puede exportar constantes a un componente de servidor —le llegan como una
 * referencia de cliente, no como el valor—, y el layout leía `undefined`.
 */

/** La barra lateral colapsada a solo iconos. Valores: "compacta" | "amplia". */
export const COOKIE_LATERAL = "kontrol_lateral";
