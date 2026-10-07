import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Sans_3, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "InkTeX — sveska u LaTeX i PDF",
  description:
    "Fotografiraj stranice iz sveske, pretvori rukopis u LaTeX i eksportuj PDF. Besplatno uz vlastiti Gemini API ključ.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sr"
      className={`${syne.variable} ${sourceSans.variable} ${ibmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
