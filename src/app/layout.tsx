import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Prism",
  description: "A light puzzle. Bend white light with mirrors and glass, split it into colours, and send each one home.",
};

// `cover`: the room paints edge to edge; controls pad themselves clear of the notch and home bar.
export const viewport: Viewport = { themeColor: "#07080c", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
