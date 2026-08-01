import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
