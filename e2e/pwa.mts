import { chromium, type Page } from "playwright";

/**
 * La app instalable: manifiesto, service worker y pantalla de sin conexión.
 *
 *   npm run dev
 *   npm run e2e:pwa
 *
 * Lo que más se comprueba aquí no es que el service worker funcione, sino que
 * **no estorbe**: un service worker mal puesto es de los errores más caros que
 * hay —se queda pegado en los teléfonos y sirve páginas viejas—, así que se
 * verifica que las Server Actions siguen pasando y que nada privado se cachea.
 */
const BASE = "http://localhost:3000";
const fallos: string[] = [];

function check(nombre: string, ok: boolean, detalle = "") {
  console.log(`${ok ? "  OK  " : " FALLA"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos.push(nombre);
}

/** Espera a que el service worker quede activo y controlando la página. */
async function esperarSw(p: Page) {
  return p.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { estado: reg.active?.state ?? "sin activar", alcance: reg.scope };
  });
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();

console.log("\n1. Manifiesto");
const manifiesto = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
check("Se sirve el manifiesto", typeof manifiesto.name === "string", manifiesto.name);
check(
  "Declara standalone y su color de barra",
  manifiesto.display === "standalone" && manifiesto.theme_color === "#031a29",
);
check(
  "Trae los iconos 192, 512 y uno maskable",
  manifiesto.icons.some((i: { sizes: string }) => i.sizes === "192x192") &&
    manifiesto.icons.some((i: { sizes: string }) => i.sizes === "512x512") &&
    manifiesto.icons.some((i: { purpose: string }) => i.purpose === "maskable"),
);
for (const icono of manifiesto.icons) {
  const r = await fetch(`${BASE}${icono.src}`);
  check(`El icono ${icono.src} existe`, r.status === 200);
}

console.log("\n2. Service worker");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const sw = await esperarSw(p);
check("Queda activo", sw.estado === "activated", sw.estado);
check("Y controla todo el sitio", sw.alcance === `${BASE}/`, sw.alcance);

console.log("\n3. No estorba a la aplicación");
// Iniciar sesión pasa por una Server Action (POST). Si el service worker la
// tocara, esto se rompería: es la comprobación que justifica la suite.
await p.fill("#username", "admin");
await p.fill("#password", "kontrol123");
await p.click('button[type="submit"]');
await p.waitForURL(`${BASE}/escritorio`, { timeout: 20000 });
check("Iniciar sesión sigue funcionando (Server Action por POST)", true);

await p.goto(`${BASE}/solicitudes`, { waitUntil: "networkidle" });
check(
  "Y la navegación entre páginas también",
  (await p.locator("h1").innerText()) === "Solicitudes",
);

console.log("\n4. Qué se guardó y qué no");
const cacheado = await p.evaluate(async () => {
  const nombres = await caches.keys();
  const urls: string[] = [];
  for (const n of nombres) {
    const c = await caches.open(n);
    urls.push(...(await c.keys()).map((r) => new URL(r.url).pathname));
  }
  return { nombres, urls };
});
console.log(`    [info] cachés: ${cacheado.nombres.join(", ")}`);
check(
  "Guarda la pantalla de sin conexión",
  cacheado.urls.includes("/sin-conexion.html"),
);
check(
  "No guarda páginas de la aplicación",
  !cacheado.urls.some((u) => ["/escritorio", "/solicitudes", "/login"].includes(u)),
  cacheado.urls.filter((u) => !u.startsWith("/_next/") && !u.startsWith("/iconos/")).join(", "),
);
check(
  "Ni nada privado: /uploads ni /api",
  !cacheado.urls.some((u) => u.startsWith("/uploads/") || u.startsWith("/api/")),
);

console.log("\n5. Los menús caben en la pantalla");
// Esta comprobación existe porque el panel de notificaciones se salía 63px por
// el borde izquierdo y los títulos llegaban cortados a media palabra. No lo vio
// ninguna prueba: se descubrió mirando un teléfono de verdad.
for (const [nombre, selector] of [
  ["campana", 'header button[aria-label*="Notificaciones"]'],
  ["persona", 'header button[aria-haspopup="menu"]:not([aria-label*="Notificaciones"])'],
] as const) {
  await p.locator(selector).last().click();
  await p.waitForTimeout(400);

  const caja = await p.locator('header [role="menu"]').last().boundingBox();
  const ancho = p.viewportSize()?.width ?? 0;
  const seSale = caja
    ? Math.round(Math.max(0, -caja.x) + Math.max(0, caja.x + caja.width - ancho))
    : -1;

  check(
    `El menú de ${nombre} no se sale de la pantalla`,
    seSale === 0,
    caja ? `x=${Math.round(caja.x)} ancho=${Math.round(caja.width)} en ${ancho}px` : "no abrió",
  );

  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

console.log("\n6. Sin conexión");
await ctx.setOffline(true);
await p.goto(`${BASE}/escritorio`, { waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(1000);
const textoOffline = await p.locator("body").innerText();
check(
  "Muestra la pantalla propia y no el error del navegador",
  textoOffline.includes("Sin conexión") && textoOffline.includes("Reintentar"),
  textoOffline.split("\n")[0],
);
// La captura se toma todavía sin red: es la pantalla que se quiere revisar.
await p.screenshot({
  path: "/private/tmp/claude-501/-Users-felconx-Desktop-Kontrol/c1bb8e1c-817c-4943-a8c6-b31442ff9ed4/scratchpad/pwa-sin-conexion.png",
});
await ctx.setOffline(false);

console.log("\n════════════════════════════════════════════════════");
console.log(
  fallos.length === 0
    ? "RESULTADO: todas las verificaciones pasaron."
    : `RESULTADO: ${fallos.length} falla(s):\n  - ${fallos.join("\n  - ")}`,
);
await nav.close();
process.exit(fallos.length === 0 ? 0 : 1);
