import type { Metadata } from "next";
import { Martian_Mono, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Precision Instrument type system:
//  - Martian Mono  → display / headings (wide, technical, machined)
//  - IBM Plex Sans → UI + body (clean, engineering pedigree, not Inter)
//  - IBM Plex Mono → data, metrics, URLs, code
const display = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PIXELDRIFT — Visual QA",
  description:
    "Pixel-precise visual regression QA. Compare live vs migration, frame by frame.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <div className="grid-backdrop" aria-hidden />
        {children}
      </body>
    </html>
  );
}
