import type { Metadata } from "next";
import { Suspense } from "react";
import { DetailFallback, StockDetailScreen } from "@/components/screens/StockDetailScreen";

export const metadata: Metadata = { title: "Stock" };

// 종목 기호는 요청 때 정해지므로 Suspense 안에서 읽는다(바깥 틀은 미리 만들어 둠)
export default function Page() {
  return (
    <Suspense fallback={<DetailFallback />}>
      <StockDetailScreen />
    </Suspense>
  );
}
