import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAG Document Assistant",
  description:
    "Production-grade RAG system with hybrid retrieval, reranking, and citation enforcement",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen">
          <nav className="w-14 border-r bg-muted/30 flex flex-col items-center py-4 gap-4">
            <a
              href="/"
              className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold"
              title="Chat"
            >
              R
            </a>
            <a
              href="/upload"
              className="w-9 h-9 rounded-md hover:bg-accent flex items-center justify-center text-sm text-muted-foreground"
              title="Upload Documents"
            >
              +
            </a>
          </nav>
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
