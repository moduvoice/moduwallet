import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/lib/pwa";
import "./globals.css";

const PRETENDARD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  title: { default: "moduwallet · 쉬운 미국 주식 지갑", template: "%s · moduwallet" },
  description: "쉽고 깔끔한 주식 지갑. 토큰화된 미국 주식을 True Markets 견적으로 1달러부터 사고팔아요.",
  applicationName: "moduwallet",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "moduwallet" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} />
      </head>
      <body className="min-h-dvh">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
