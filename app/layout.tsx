import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import InstalarApp from "@/components/instalar-app";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPCION =
  "Gestión de solicitudes y entrega de equipamiento y EPP para brigadas y personal.";

export const metadata: Metadata = {
  title: "Kontrol",
  description: DESCRIPCION,
  // El favicon y los iconos salen de app/icon.png y app/apple-icon.png por
  // convención del App Router; aquí solo va la tarjeta de los enlaces
  // compartidos (WhatsApp, correo), que necesita una imagen propia.
  openGraph: {
    title: "Kontrol",
    description: DESCRIPCION,
    siteName: "Kontrol",
    locale: "es_CL",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kontrol" }],
  },
  // Instalada, iOS no lee el manifiesto: necesita estas dos para abrirse a
  // pantalla completa y poner bien el rótulo bajo el icono.
  appleWebApp: { capable: true, title: "Kontrol", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Tiñe la barra de estado del color de la barra de la app. Es lo que hace que
  // instalada no se vea como una web dentro de un marco ajeno.
  themeColor: "#031a29",
  // El zoom se deja libre a propósito: esto se lee bajo sol fuerte y con la
  // vista cansada, y bloquearlo es de las cosas que más molestan en terreno.
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Registra el service worker y, más adelante, ofrece instalar. Va en
            el layout raíz para que también cubra el login: quien instala desde
            ahí se ahorra teclear la dirección la próxima vez. */}
        <InstalarApp />
      </body>
    </html>
  );
}
