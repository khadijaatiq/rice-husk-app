import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Rice Husk Ledger",
  description: "Purchase-and-sale ledger for rice husk trading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-900">Rice Husk Ledger</span>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/import" className="text-sm text-gray-600 hover:text-gray-900">Import</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
