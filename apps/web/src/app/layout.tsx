import type { Metadata } from "next";
import "../components/product-shell/product-shell.css";

export const metadata: Metadata = {
  title: "E-moment | Your moments, beautifully framed.",
  description: "A digital photo-box experience for moments made alone or together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
