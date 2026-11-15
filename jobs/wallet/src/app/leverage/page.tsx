import type { Metadata } from "next";
import { LeverageScreen } from "@/components/screens/LeverageScreen";

export const metadata: Metadata = { title: "레버리지" };

export default function Page() {
  return <LeverageScreen />;
}
