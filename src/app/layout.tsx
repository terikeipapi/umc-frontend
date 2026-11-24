import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "../components/layout/header";
import Footer from "../components/layout/footer";
import { Providers } from "./providers";
import "../style.css";

export const metadata: Metadata = {
  title: "UMCine",
  description: "영화를 검색하고 나만의 찜과 평점을 기록하는 UMCine",
  icons: { icon: "/icons/movie.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div id="root">
          <Providers>
            <Header />
            {children}
            <Footer />
          </Providers>
        </div>
      </body>
    </html>
  );
}
