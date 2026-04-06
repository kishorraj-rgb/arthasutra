import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/components/convex-provider";
import { NextAuthProvider } from "@/components/session-provider";

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
    <html lang="en">
      <body className="antialiased bg-surface-secondary text-text-primary min-h-screen">
        <NextAuthProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
