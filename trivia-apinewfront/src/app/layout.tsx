import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/providers/AppProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trivia — Live Quiz with Real Prizes",
  description: "Join live trivia games and win real cash prizes. Answer questions correctly and beat other players!",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Динамический lang из cookie NEXT_LOCALE с валидацией (только ru|kk)
  // Компромисс: чтение cookie делает layout динамическим, но он уже динамический из-за auth context
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = raw === "kk" ? "kk" : "ru";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased min-h-app bg-background font-sans`}
      >
        <AppProviders>
          {children}
          <Toaster position="top-right" richColors />
        </AppProviders>
      </body>
    </html>
  );
}
