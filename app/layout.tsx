import type { Metadata, Viewport } from "next";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "奶龙消消乐",
  description: "支持自定义名称和图片的三消游戏。",
  openGraph: {
    title: "奶龙消消乐",
    description: "支持自定义名称和图片的三消游戏。",
    images: [{ url: "/og-match3.png", width: 1536, height: 1024, alt: "奶龙消消乐" }],
  },
  twitter: { card: "summary_large_image", title: "奶龙消消乐", description: "支持自定义名称和图片的三消游戏。", images: ["/og-match3.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
