"use client";

import { useEffect, useState } from "react";

/**
 * Registra el service worker y ofrece instalar la app.
 *
 * Las dos cosas van juntas porque Android no ofrece instalar nada hasta que hay
 * un service worker registrado y un manifiesto válido: son la misma función.
 *
 * Hay **dos caminos distintos**, y ninguno sirve para el otro:
 *
 * - **Android/Chrome** dispara `beforeinstallprompt`, que se guarda para
 *   lanzarlo cuando convenga, y la instalación es un botón.
 * - **iOS/Safari** no implementa ese evento y nunca lo hará: Apple solo permite
 *   instalar a mano desde el menú Compartir. Ahí lo único que se puede hacer es
 *   explicar el gesto, así que se muestran las instrucciones.
 *
 * En ambos casos el aviso espera. Quien recién entra está intentando hacer algo
 * —pedir unas botas, firmar una entrega— y una tarjeta que le pide instalar
 * antes de dejarlo trabajar es un peaje. Si lo descarta, no se vuelve a ofrecer.
 */

/** El evento de Chrome que permite disparar la instalación cuando queramos. */
type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CLAVE_DESCARTADO = "kontrol_instalacion_descartada";
const ESPERA_MS = 30_000;

/**
 * Si hay navegador de verdad al que preguntarle.
 *
 * Se mira `window` y **no** `navigator`: Node define `navigator` desde hace
 * varias versiones, así que preguntarle a él da por bueno el servidor y luego
 * revienta en el primer `matchMedia`, que sí es exclusivo del navegador. Con
 * este componente eso tumbaba el build entero al prerenderizar /login.
 */
function enElNavegador(): boolean {
  return typeof window !== "undefined";
}

/** Ya está instalada y abierta como app: no hay nada que ofrecer. */
function yaInstalada(): boolean {
  if (!enElNavegador()) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Lo de iOS, que no usa `display-mode`.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Safari de iOS o iPadOS. El iPad moderno se declara como Mac, así que además
 * se mira si la pantalla es táctil.
 */
function esSafariDeApple(): boolean {
  const ua = navigator.userAgent;
  const esApple =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!esApple) return false;

  // Chrome y Firefox en iOS son Safari por dentro, pero su menú Compartir está
  // en otro sitio y las instrucciones no calzarían.
  return !/CriOS|FxiOS|EdgiOS/.test(ua);
}

type Modo = "android" | "ios" | null;

/**
 * Qué ofrecer en este dispositivo, resuelto en el primer render.
 *
 * Va en el inicializador del estado y no en un efecto porque no es una
 * suscripción a nada: es una pregunta al entorno con una sola respuesta. En el
 * servidor no hay navegador al que preguntarle, y ahí devuelve null; como la
 * tarjeta arranca oculta, lo que se pinta es idéntico en ambos lados y la
 * hidratación no se entera.
 */
function modoInicial(): Modo {
  if (!enElNavegador()) return null;
  if (yaInstalada()) return null;
  if (localStorage.getItem(CLAVE_DESCARTADO)) return null;

  // Android se resuelve más tarde, cuando el navegador avise que se puede
  // instalar; iOS nunca avisa, así que se decide aquí.
  return esSafariDeApple() ? "ios" : null;
}

export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [visible, setVisible] = useState(false);

  // ── Service worker ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Tras la carga, no durante: registrarlo compite por ancho de banda con lo
    // que la persona vino a ver, y en terreno ese ancho de banda es escaso.
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        // Falla siempre fuera de HTTPS (salvo en localhost): el navegador no
        // registra service workers en contextos inseguros. No puede romper la
        // app —sin él Kontrol funciona igual—, pero conviene dejarlo dicho.
        console.warn(
          "[pwa] no se registró el service worker. Requiere HTTPS o localhost.",
          e,
        );
      });
    };

    if (document.readyState === "complete") registrar();
    else {
      addEventListener("load", registrar);
      return () => removeEventListener("load", registrar);
    }
  }, []);

  // ── Android: esperar a que el navegador diga que se puede instalar ──────
  useEffect(() => {
    if (yaInstalada() || localStorage.getItem(CLAVE_DESCARTADO)) return;

    const alPoderInstalar = (e: Event) => {
      // Sin esto, Chrome muestra su propia barra en el momento que quiere.
      e.preventDefault();
      setEvento(e as EventoInstalacion);
      setModo("android");
    };

    addEventListener("beforeinstallprompt", alPoderInstalar);
    return () => removeEventListener("beforeinstallprompt", alPoderInstalar);
  }, []);

  useEffect(() => {
    if (!modo) return;
    const id = setTimeout(() => setVisible(true), ESPERA_MS);
    return () => clearTimeout(id);
  }, [modo]);

  // Si la instalan mientras la tarjeta está en pantalla, se retira sola.
  useEffect(() => {
    const alInstalar = () => {
      setVisible(false);
      setModo(null);
    };
    addEventListener("appinstalled", alInstalar);
    return () => removeEventListener("appinstalled", alInstalar);
  }, []);

  function descartar() {
    setVisible(false);
    localStorage.setItem(CLAVE_DESCARTADO, "1");
  }

  async function instalar() {
    if (!evento) return;
    setVisible(false);
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    // Aceptada o no, el evento se consume: no se puede volver a usar.
    setEvento(null);
    if (outcome === "dismissed") localStorage.setItem(CLAVE_DESCARTADO, "1");
  }

  if (!visible || !modo) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar Kontrol"
      className="no-print fixed inset-x-3 bottom-3 z-[var(--z-aviso)] mx-auto max-w-sm rounded-xl border border-borde bg-panel p-4 shadow-xl sm:inset-x-auto sm:right-4"
    >
      <p className="text-sm font-semibold text-tinta">Instala Kontrol</p>

      {modo === "android" ? (
        <>
          <p className="mt-1 text-sm text-tinta-suave">
            Queda como una app en tu pantalla de inicio: se abre más rápido y sin
            la barra del navegador.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={instalar}
              className="foco-anillo inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-marca-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-marca-700"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={descartar}
              className="foco-anillo inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-borde-fuerte px-4 text-sm font-medium text-tinta-suave transition-colors duration-150 hover:bg-panel-suave"
            >
              Ahora no
            </button>
          </div>
        </>
      ) : (
        <>
          {/* iOS no deja instalar por código: solo queda enseñar el gesto. */}
          <p className="mt-1 text-sm text-tinta-suave">
            En iPhone se agrega a mano, en dos toques:
          </p>
          <ol className="mt-2 space-y-1.5 text-sm text-tinta-suave">
            <li className="flex gap-2">
              <span className="font-semibold text-tinta">1.</span>
              <span>
                Toca{" "}
                <span className="inline-flex items-center gap-1 font-medium text-tinta">
                  Compartir
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="inline size-4"
                    aria-hidden="true"
                  >
                    <path d="M12 15V3" />
                    <path d="m8 7 4-4 4 4" />
                    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                  </svg>
                </span>{" "}
                abajo en la barra de Safari.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-tinta">2.</span>
              <span>
                Elige{" "}
                <span className="font-medium text-tinta">
                  «Añadir a pantalla de inicio»
                </span>
                .
              </span>
            </li>
          </ol>
          <div className="mt-3">
            <button
              type="button"
              onClick={descartar}
              className="foco-anillo inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-borde-fuerte px-4 text-sm font-medium text-tinta-suave transition-colors duration-150 hover:bg-panel-suave"
            >
              Entendido
            </button>
          </div>
        </>
      )}
    </div>
  );
}
