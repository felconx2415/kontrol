import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { requerirUsuario } from "@/lib/auth";
import { ETIQUETA_ROL } from "@/lib/solicitud-estado";
import NavPrincipal from "@/components/nav-principal";
import MenuMovil from "@/components/menu-movil";
import MenuPersona from "@/components/menu-persona";
import AvisoFlotante from "@/components/aviso-flotante";
import CampanaNotificaciones from "@/components/campana-notificaciones";
import PieSitio from "@/components/pie-sitio";
import { barraDe, gruposDe, menuPersonaDe } from "@/lib/navegacion";
import { COOKIE_AVISO } from "@/lib/avisos";
import {
  contarNoLeidas,
  listarNotificaciones,
  NOTIFICACIONES_EN_CAMPANA,
} from "@/lib/notificaciones";
import { haceCuanto } from "@/lib/tiempo-relativo";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirUsuario();

  // Mensaje de confirmación dejado por la última Server Action. Va en cookie y
  // no en la URL para no ensuciar el enlace que el usuario puede compartir.
  const aviso = (await cookies()).get(COOKIE_AVISO)?.value ?? null;

  // La campana viene resuelta desde aquí: abrirla no dispara ninguna consulta,
  // que en terreno con señal intermitente es la diferencia entre un menú útil
  // y uno que se queda cargando.
  const [sinLeer, ultimasNotificaciones] = await Promise.all([
    contarNoLeidas(usuario.id),
    listarNotificaciones(usuario.id, NOTIFICACIONES_EN_CAMPANA),
  ]);

  // Los destinos salen de lib/navegacion.ts, no de una lista armada aquí: son
  // tres superficies (barra, menú del nombre, cajón) y mantenerlas a mano las
  // desincroniza sola.
  const barra = barraDe(usuario);
  const destinosPersona = menuPersonaDe(usuario);
  const gruposCajon = gruposDe(usuario);

  const detallePersona = `${ETIQUETA_ROL[usuario.rol]}${
    usuario.brigadaNombre ? ` · ${usuario.brigadaNombre}` : ""
  }`;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* La barra dejó de ser una franja a sangre con una segunda fila de
          pestañas: ahora es una sola píldora oscura flotando sobre el lienzo.
          Todo cabe en una línea, así que el contenido empieza ~44px más
          arriba. Bajo lg los destinos no entran, y el cajón toma el
          relevo. La píldora es pegajosa: al hacer scroll queda flotando sobre
          el contenido, con el hueco de su padding dejando ver el lienzo. */}
      <header className="no-print sticky top-0 z-[var(--z-pegajoso)] px-3 pt-3 text-sm text-white sm:px-4 sm:pt-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4 rounded-full border border-white/15 bg-marca-950 px-3 py-2.5 shadow-lg shadow-marca-950/10 sm:px-5">
          <div className="flex min-w-0 items-center gap-1">
            <MenuMovil
              grupos={gruposCajon}
              usuarioNombre={usuario.nombre}
              usuarioRol={detallePersona}
            />
            <Link
              href="/escritorio"
              aria-label="Kontrol · ir al escritorio"
              className="foco-anillo-claro flex items-center rounded-full py-1 pr-2 lg:pr-4"
            >
              {/* Logotipo completo: la palabra viene en blanco y la píldora es
                  oscura, así que se apoya tal cual sobre ella. */}
              <Image
                src="/logo-kontrol.png"
                alt="Kontrol"
                width={600}
                height={148}
                priority
                className="h-6 w-auto"
              />
            </Link>
          </div>

          <NavPrincipal enlaces={barra} />

          {/* `min-w-0` + `truncate`: un nombre largo se recorta en vez de
              empujar los destinos y solaparse con ellos. */}
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
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

            {/* El nombre dejó de ser un enlace suelto al perfil: ahora abre el
                menú con lo de cada uno —equipamiento, documentos, perfil— y con
                «Salir», que era la acción menos frecuente de todas y ocupaba el
                sitio más caro de la pantalla. */}
            <MenuPersona
              nombre={usuario.nombre}
              detalle={detallePersona}
              destinos={destinosPersona.map((d) => ({
                id: d.id,
                href: d.href,
                texto: d.texto,
              }))}
            />
          </div>
        </div>
      </header>

      {/* Al imprimir, la píldora se oculta (`no-print`) y la hoja quedaba sin
          marca. Este encabezado solo existe en papel, con la variante de
          palabra oscura. */}
      <div className="hidden px-4 pt-6 print:block">
        <Image
          src="/logo-kontrol-oscuro.png"
          alt="Kontrol"
          width={600}
          height={148}
          className="h-6 w-auto"
        />
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <PieSitio />

      {aviso && <AvisoFlotante mensaje={aviso} />}
    </div>
  );
}
