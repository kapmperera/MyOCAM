import { Outfit } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "MyOCAM | Academic Management System",
  description: "Enterprise-level Academic Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
