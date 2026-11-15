import type { Metadata, Viewport } from "next";
import { AppChrome } from "@/components/chrome";
import { PwaRegister } from "@/lib/pwa";
import "./globals.css";

const PRETENDARD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  title: { default: "moduwallet · the easy wallet for U.S. stocks", template: "%s · moduwallet" },
  description:
    "A simple, clean wallet. Buy and sell tokenized U.S. stocks from $1 with live True Markets quotes. 쉽고 깔끔한 미국 주식 지갑.",
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

// 첫 화면이 그려지기 전에 언어(<html lang>)와 등락 색 규칙을 맞춘다. src/i18n/index.ts 의 detect() 와 같은 규칙.
// 영어가 아니면 글자가 바뀔 때까지 잠깐 숨긴다(globals.css 의 .i18n-wait).
const LANG_BOOT = `(function(){try{var ok=["ko","en","zh","th","vi","ru"],l=localStorage.getItem("moduwallet.lang.v1");if(ok.indexOf(l)<0){l=null;var n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||"en"];for(var i=0;i<n.length&&!l;i++){var p=(n[i]||"").toLowerCase().slice(0,2);if(ok.indexOf(p)>=0)l=p}}l=l||"en";var d=document.documentElement;d.lang=l==="zh"?"zh-CN":l;d.setAttribute("data-tone",l==="ko"||l==="zh"?"east":"west");if(l!=="en")d.classList.add("i18n-wait")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-tone="west" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT }} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} />
      </head>
      <body className="min-h-dvh">
        {children}
        <AppChrome />
        <PwaRegister />
      </body>
    </html>
  );
}
