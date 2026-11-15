import type { Metadata } from "next";
import { LeverageScreen } from "@/components/screens/LeverageScreen";

export const metadata: Metadata = { title: "Leverage" };

export default function Page() {
  return <LeverageScreen />;
}
