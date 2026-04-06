import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/components/convex-provider";

export const metadata: Metadata = {
  title: "ArthaSutra - अर्थसूत्र | Indian Personal Finance Manager",
  description: "Comprehensive financial OS for Indian professionals — tax planning, investments, GST, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-navy text-white min-h-screen">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
