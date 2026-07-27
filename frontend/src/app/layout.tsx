import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AIChatbot from "@/components/layout/AIChatbot";
import { Suspense } from "react";
import "./globals.css";
import GoogleProvider from "@/providers/GoogleProvider";

export const dynamic = "force-dynamic";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PickleClub",
  description: "Pickleball Court & Coach Booking System",
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={beVietnamPro.className} suppressHydrationWarning>
        <GoogleProvider>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>

          {children}

          <Footer />
          <AIChatbot />
        </GoogleProvider>
      </body>
    </html>
  );
}