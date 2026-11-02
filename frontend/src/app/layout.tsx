import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LetsDate — Make room for meaningful connections",
  description:
    "Meet people who make you smile. Create your LetsDate profile and discover meaningful connections.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}