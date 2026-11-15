import type { Metadata } from "next";
import { StocksScreen } from "@/components/screens/StocksScreen";

export const metadata: Metadata = { title: "주식 찾기" };

export default function Page() {
  return <StocksScreen />;
}
