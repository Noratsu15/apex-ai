import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Apex IA — Chat inteligente (Beta)",
  description:
    "Asistente de IA en fase beta: responde preguntas, genera imágenes, crea documentos Word, guarda el historial y recuerda lo importante.",
  keywords: ["Apex IA", "chat", "inteligencia artificial", "beta", "generación de imágenes", "documentos"],
  icons: {
    icon: "https://ik.imagekit.io/ugythf2a3/logo.png?updatedAt=1791496158688",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
