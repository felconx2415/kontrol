import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { requerirUsuario } from "@/lib/auth";
import { ETIQUETA_ROL, esAdmin, esGestion } from "@/lib/solicitud-estado";
import { cerrarSesion } from "@/actions/sesion";
import NavPrincipal, { type EnlaceNav } from "@/components/nav-principal";
import MenuMovil from "@/components/menu-movil";
import AvisoFlotante from "@/components/aviso-flotante";
import { COOKIE_AVISO } from "@/lib/avisos";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirUsuario();

  // Mensaje de confirmación dejado por la última Server Action. Va en cookie y
  // no en la URL para no ensuciar el enlace que el usuario puede compartir.
  const aviso = (await cookies()).get(COOKIE_AVISO)?.value ?? null;

  const enlaces: EnlaceNav[] = [
    { href: "/escritorio", texto: "Escritorio", icono: "escritorio" },
    { href: "/solicitudes", texto: "Solicitudes", icono: "solicitudes" },
    { href: `/historial/${usuario.id}`, texto: "Mi equipamiento", icono: "equipamiento" },
  ];

  if (esGestion(usuario.rol)) {
    enlaces.push(
      { href: "/bodega", texto: "Bodega", icono: "bodega" },
      { href: "/reportes", texto: "Reportes", icono: "reportes" },
      { href: "/admin/articulos", texto: "Catálogo", icono: "catalogo" },
    );
  }

  // La administración de cuentas es exclusiva del rol ADMIN.
  if (esAdmin(usuario.rol)) {
    enlaces.push(
      { href: "/admin/usuarios", texto: "Usuarios", icono: "usuarios" },
      { href: "/admin/brigadas", texto: "Brigadas", icono: "brigadas" },
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* La barra dejó de ser una franja a sangre con una segunda fila de
          pestañas: ahora es una sola píldora oscura flotando sobre el lienzo.
          Todo cabe en una línea, así que el contenido empieza ~44px más
          arriba. Bajo lg los ocho destinos no entran, y el cajón toma el
          relevo. La píldora es pegajosa: al hacer scroll queda flotando sobre
          el contenido, con el hueco de su padding dejando ver el lienzo. */}
      <header className="no-print sticky top-0 z-[var(--z-pegajoso)] px-3 pt-3 text-sm text-white sm:px-4 sm:pt-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4 rounded-full border border-white/15 bg-marca-950 px-3 py-2.5 shadow-lg shadow-marca-950/10 sm:px-5">
          <div className="flex min-w-0 items-center gap-1">
            <MenuMovil
              enlaces={enlaces}
              usuarioNombre={usuario.nombre}
              usuarioRol={`${ETIQUETA_ROL[usuario.rol]}${
                usuario.brigadaNombre ? ` · ${usuario.brigadaNombre}` : ""
              }`}
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

          <NavPrincipal enlaces={enlaces} />

          {/* `min-w-0` + `truncate`: un nombre largo se recorta en vez de
              empujar los destinos y solaparse con ellos. */}
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium leading-tight">
                {usuario.nombre}
              </p>
              <p className="truncate text-xs leading-tight text-marca-200">
                {ETIQUETA_ROL[usuario.rol]}
                {usuario.brigadaNombre ? ` · ${usuario.brigadaNombre}` : ""}
              </p>
            </div>
            <form action={cerrarSesion} className="shrink-0">
              <button
                type="submit"
                className="foco-anillo-claro inline-flex cursor-pointer items-center rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10"
              >
                Salir
              </button>
            </form>
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

      {aviso && <AvisoFlotante mensaje={aviso} />}
    </div>
  );
}
