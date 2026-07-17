import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppMotionProvider } from "./providers";

const atkinson = localFont({
  src: "./fonts/atkinson-hyperlegible-next-latin-ext.woff2",
  variable: "--font-atkinson",
  weight: "200 800",
  style: "normal",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Señal de Vida",
  description: "Reserva de citas médicas — Clínica Señal de Vida, Ayacucho",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppMotionProvider>{children}</AppMotionProvider>
      </body>
    </html>
  );
}
