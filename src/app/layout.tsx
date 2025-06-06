// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Your global styles
import { AuthProvider } from "../context/AuthContext"; // Adjust path
import Navbar from "../components/Navbar"; // Adjust path if Navbar is elsewhere

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cardano Loan Tracker",
  description: "Track your loans with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar /> {/* <-- Add Navbar here */}
          <main style={{ padding: "1rem" }}> {/* Add some padding to main content */}
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}