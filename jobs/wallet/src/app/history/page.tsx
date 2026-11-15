import type { Metadata } from "next";
import { HistoryScreen } from "@/components/screens/HistoryScreen";

export const metadata: Metadata = { title: "거래 내역" };

export default function Page() {
  return <HistoryScreen />;
}
