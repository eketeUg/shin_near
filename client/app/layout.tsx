import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google"; // Changed from Geist
import "./globals.css";
import Providers from "./components/Providers";

// Configure Cinzel (Serif / Display)
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700", "900"], // Regular, Bold, Black
});

// Configure Inter (Sans / UI)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "600"], // Light, Regular, SemiBold
});

export const metadata: Metadata = {
  title: "SHIN: The Struggle",
  description: "A 2D Shinobi & Samurai PvP and Autonomous Agent fighting game on NEAR.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${cinzel.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
