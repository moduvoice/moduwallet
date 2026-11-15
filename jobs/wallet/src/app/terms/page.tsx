import type { Metadata } from "next";
import { TermsScreen } from "@/components/screens/TermsScreen";

export const metadata: Metadata = { title: "Terms & risks" };

export default function Page() {
  return <TermsScreen />;
}
