import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { requerirUsuario } from "@/lib/auth";
import { ETIQUETA_ROL } from "@/lib/solicitud-estado";
import BarraLateral from "@/components/barra-lateral";
import { COOKIE_LATERAL } from "@/lib/preferencias";
import BuscadorGlobal from "@/components/buscador-global";
import MenuMovil from "@/components/menu-movil";
import MenuPersona from "@/components/menu-persona";
import AvisoFlotante from "@/components/aviso-flotante";
import CampanaNotificaciones from "@/components/campana-notificaciones";
import PieSitio from "@/components/pie-sitio";
import { ajustesDe, lateralDe, type GrupoLateral } from "@/lib/navegacion";
import { COOKIE_AVISO } from "@/lib/avisos";
import {
  contarNoLeidas,
  listarNotificaciones,
  NOTIFICACIONES_EN_CAMPANA,
} from "@/lib/notificaciones";
import { haceCuanto } from "@/lib/tiempo-relativo";

/** Los grupos sin los campos que no viajan al cliente. */
function paraCliente(grupos: GrupoLateral[]) {
  return grupos.map((g) => ({
    grupo: g.grupo,
    titulo: g.titulo,
    hrefTitulo: g.hrefTitulo,
    destinos: g.destinos.map((d) => ({ href: d.href, texto: d.texto, icono: d.icono })),
  }));
}

/**
 * El panel: barra lateral con la navegación a la izquierda y, a la derecha, la
 * columna de trabajo con su barra superior (buscar, avisos, mi cuenta).
 *
 * Sustituye a la píldora oscura flotante de las versiones anteriores. Aquella
 * tenía una sola línea para todo, así que la navegación se repartía entre la
 * píldora, el menú del nombre y un índice de configuración; ahora cada cosa
 * tiene su sitio: lo que se hace, a la izquierda; lo que es de la cuenta,
 * arriba a la derecha.
 */
export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirUsuario();
  const tarro = await cookies();

  // Mensaje de confirmación dejado por la última Server Action. Va en cookie y
  // no en la URL para no ensuciar el enlace que el usuario puede compartir.
  const aviso = tarro.get(COOKIE_AVISO)?.value ?? null;
  const lateralCompacta = tarro.get(COOKIE_LATERAL)?.value === "compacta";

  // La campana viene resuelta desde aquí: abrirla no dispara ninguna consulta,
  // que en terreno con señal intermitente es la diferencia entre un menú útil
  // y uno que se queda cargando.
  const [sinLeer, ultimasNotificaciones] = await Promise.all([
    contarNoLeidas(usuario.id),
    listarNotificaciones(usuario.id, NOTIFICACIONES_EN_CAMPANA),
  ]);

  // Los destinos salen de lib/navegacion.ts: la barra lateral y el cajón del
  // teléfono muestran lo mismo, y el menú de la cuenta lo suyo.
  const grupos = paraCliente(lateralDe(usuario));
  const ajustes = ajustesDe(usuario);

  // Quien no está en ninguna brigada se identifica por su cargo: «Gestor ·
  // Prevencionista de riesgo» dice más que «Gestor» a secas.
  const grupoPersona = usuario.brigadaNombre ?? usuario.cargoNombre;
  const detallePersona = `${ETIQUETA_ROL[usuario.rol]}${
    grupoPersona ? ` · ${grupoPersona}` : ""
  }`;
  const empresaPersona =
    usuario.empresasGestionadas.length > 1
      ? `Atiende ${usuario.empresasGestionadas.length} empresas`
      : (usuario.empresaNombre ?? (usuario.rol === "ADMIN" ? "Todas las empresas" : null));

  return (
    <div className="flex min-h-full flex-1">
      <BarraLateral grupos={grupos} compactaInicial={lateralCompacta} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior: fondo del lienzo con un velo, para que el contenido
            que pasa por debajo al hacer scroll no se lea a través de ella. */}
        <header className="no-print sticky top-0 z-[var(--z-pegajoso)] border-b border-borde bg-lienzo/85 backdrop-blur supports-[backdrop-filter]:bg-lienzo/70">
          <div className="mx-auto flex h-16 max-w-[110rem] items-center gap-3 px-4 lg:px-8">
            {/* Bajo lg no hay barra lateral: el cajón y el logo toman el
                relevo. */}
            <div className="flex min-w-0 items-center gap-1 lg:hidden">
              <MenuMovil
                grupos={grupos}
                usuarioNombre={usuario.nombre}
                usuarioRol={detallePersona}
              />
              <Link
                href="/escritorio"
                aria-label="Kontrol · ir al escritorio"
                className="foco-anillo flex items-center rounded-lg py-1 pr-2"
              >
                <Image
                  src="/logo-kontrol-oscuro.png"
                  alt="Kontrol"
                  width={600}
                  height={148}
                  priority
                  className="h-6 w-auto"
                />
              </Link>
            </div>

            <div className="hidden min-w-0 flex-1 md:block">
              <BuscadorGlobal />
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
              <CampanaNotificaciones
                sinLeer={sinLeer}
                notificaciones={ultimasNotificaciones.map((n) => ({
                  id: n.id,
                  titulo: n.titulo,
                  cuerpo: n.cuerpo,
                  url: n.url,
                  leida: n.leidaEn !== null,
                  cuando: haceCuanto(n.creadaEn),
                }))}
              />

              <MenuPersona
                nombre={usuario.nombre}
                detalle={detallePersona}
                empresa={empresaPersona}
                destinos={ajustes.map((d) => ({
                  id: d.id,
                  href: d.href,
                  texto: d.texto,
                  icono: d.icono,
                }))}
              />
            </div>
          </div>
        </header>

        {/* Al imprimir, las barras se ocultan (`no-print`) y la hoja quedaba
            sin marca. Este encabezado solo existe en papel. */}
        <div className="hidden px-4 pt-6 print:block">
          <Image
            src="/logo-kontrol-oscuro.png"
            alt="Kontrol"
            width={600}
            height={148}
            className="h-6 w-auto"
          />
        </div>

        {/* Hasta 1760px: en un monitor ancho la franja central de antes dejaba
            casi un tercio de la pantalla vacío. Los formularios siguen con su
            propio ancho angosto, que es como se leen bien. */}
        <main className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-5 sm:py-6 lg:px-8">
          {children}
        </main>

        <PieSitio />
      </div>

      {aviso && <AvisoFlotante mensaje={aviso} />}
    </div>
  );
}
