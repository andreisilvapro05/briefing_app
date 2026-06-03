import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Briefing · Fysi Lab",
  description:
    "Portal de onboarding da Fysi Lab. Sistema estruturado de coleta de briefing para landing pages e sites.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Fysi",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/apple-icon.svg",
    apple: "/apple-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#042B30",
  width: "device-width",
  initialScale: 1,
  // Permite zoom — acessibilidade > estética.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
