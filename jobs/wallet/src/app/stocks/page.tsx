import type { Metadata } from "next";
import { StocksScreen } from "@/components/screens/StocksScreen";

export const metadata: Metadata = { title: "Stocks" };

export default function Page() {
  return <StocksScreen />;
}
