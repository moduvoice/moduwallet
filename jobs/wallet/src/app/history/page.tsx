import type { Metadata } from "next";
import { HistoryScreen } from "@/components/screens/HistoryScreen";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return <HistoryScreen />;
}
