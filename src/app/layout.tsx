// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '../context/AuthContext'; // Adjust path if needed
import { WagmiClientProvider } from "../context/WagmiContext"; // <-- Import MeshProvider
import Navbar from "@/components/Navbar";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LoanTracker",
  description: "A decentralized loan management application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/*
          Wrap your entire application with MeshProvider.
          This makes wallet state available everywhere.
        */}
        <WagmiClientProvider>
          <AuthProvider>
            <Navbar />
            <main className="container mx-auto">
              {children}
            </main>
          </AuthProvider>
        </WagmiClientProvider>
      </body>
    </html>
  );
}