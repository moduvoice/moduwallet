// 화면(UI)과 서버(API)가 함께 쓰는 데이터 형식. 바꿀 때는 양쪽을 같이 고친다.

export type Range = "1D" | "1W" | "1M" | "3M" | "1Y";

/** 거래할 수 있는 종목 하나(같은 주식이 여러 체인에 있으면 하나로 묶은 대표) */
export type Stock = {
  symbol: string; // 화면에 보이는 기호: NVDA, TSLA, SPY ...
  name: string; // NVIDIA, Tesla ...
  nameKo?: string; // 엔비디아, 테슬라 ... (있는 종목만)
  icon?: string; // 로고 이미지 URL
  kind: "stock" | "etf" | "crypto";
};

/** 현재가 */
export type Price = {
  symbol: string;
  price: number; // USD
  change24h: number; // 24시간 등락률, 0.012 = +1.2%
};

export type HistoryPoint = { t: string; price: number }; // t: ISO 시각

/** True Markets 실제 견적(잔고 없이도 받음) */
export type TradeQuote = {
  symbol: string;
  side: "buy" | "sell";
  usd: number; // 살 때: 내는 USDC(수수료 포함) / 팔 때: 받는 USDC(수수료 뺀 값)
  qty: number; // 살 때: 받는 주식 수 / 팔 때: 내는 주식 수
  price: number; // 1주당 체결 예상가
  fee: number; // 수수료(USD)
  expiresAt: string; // 견적 만료 시각(약 2분)
  source: "truemarkets" | "estimate"; // estimate = 실견적 실패 시 현재가로 계산
};

export type Trade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  usd: number;
  fee: number;
  at: string; // ISO
  mode: "demo" | "live";
};

export type Holding = { symbol: string; qty: number; avgPrice: number };

/** 데모 지갑 상태(브라우저 localStorage 에 저장) */
export type Portfolio = {
  usdc: number;
  holdings: Holding[];
  trades: Trade[];
};
