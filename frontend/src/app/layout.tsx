import type { Metadata, Viewport } from "next";
import { Anton, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { AuthHydrator, ToastContainer } from "@/components/Providers";
import { TryOnModal } from "@/components/TryOnFlow";

const sans = Inter({ subsets:["latin"], variable:"--font-sans", display:"swap" });
const display = Anton({ weight:"400", subsets:["latin"], variable:"--font-display", display:"swap" });
const serif = Instrument_Serif({ weight:"400", subsets:["latin"], variable:"--font-serif", style:["normal","italic"], display:"swap" });

export const metadata: Metadata = {
  title: { default:"Raritone — Point. Try. Snap.", template:"%s — Raritone" },
  description: "The camera-first try-on playground. Go live and see any outfit on you in realtime — on our catalog or any site on the internet.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Raritone" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: { type:"website", siteName:"Raritone", title:"Raritone — Try Before You Buy", description:"AI-powered fashion shopping with virtual try-on." },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
};

export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
      <html lang="en" className={`${sans.variable} ${display.variable} ${serif.variable}`}>
      <body className="min-h-screen flex flex-col">
        <AuthHydrator>
          <Header />
          <main className="flex-1 pb-16 lg:pb-0">{children}</main>
          <Footer />
          <MobileNav />
          <TryOnModal />
          <ToastContainer />
        </AuthHydrator>
      </body>
    </html>
  );
}
