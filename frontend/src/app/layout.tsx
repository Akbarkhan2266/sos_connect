import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "SOS Connect — help, nearby",
  description: "Emergency response coordinator. Raise an SOS or go on duty to help someone nearby, in real time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAFAF7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-body bg-paper text-ink antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
