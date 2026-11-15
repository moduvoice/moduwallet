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
  source: "truemarkets" | "estimate"; // estimate = True Markets 견적 실패 시 현재가로 계산
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
  // 레버리지 거래일 때만
  kind?: "spot" | "perp-open" | "perp-close" | "perp-liquidated";
  leverage?: number;
  positionSide?: "long" | "short";
  pnl?: number; // 닫을 때 손익(USD)
};

export type Holding = { symbol: string; qty: number; avgPrice: number };

/** 데모 지갑 상태(브라우저 localStorage 에 저장) */
export type Portfolio = {
  usdc: number;
  holdings: Holding[];
  trades: Trade[];
  positions?: Position[]; // 레버리지 포지션(옛 저장본에는 없을 수 있음)
};

// ---------- 레버리지(무기한 선물) ----------
export type PerpGroup = "stock" | "index" | "commodity" | "crypto";

/** 레버리지로 거래할 수 있는 종목 */
export type PerpMarket = {
  symbol: string; // NVDA, SP500, CL ...
  name: string; // 영어 이름
  nameKo: string; // 엔비디아, S&P 500, 원유(WTI) ...
  icon?: string;
  group: PerpGroup;
  maxLeverage: number; // 이 종목의 최대 배율
  fundingRate: number; // 1시간 펀딩비(+면 롱이 숏에게 냄)
};

/** 레버리지 열기 견적(True Markets /quotes) */
export type PerpQuote = {
  symbol: string;
  side: "long" | "short"; // long = 오를 것 같아요, short = 내릴 것 같아요
  leverage: number;
  margin: number; // 내가 넣는 돈(USD)
  qty: number; // 포지션 크기(주·개)
  price: number; // 진입 예상가
  notional: number; // 포지션 금액 = margin × leverage (대략)
  fee: number; // 여는 수수료(USD), margin 과 별도로 낸다
  liqPrice: number; // 예상 청산가 - 여기까지 가면 넣은 돈을 모두 잃어요
  expiresAt: string;
  source: "truemarkets" | "estimate";
};

/** 레버리지 닫기 견적 */
export type PerpCloseQuote = {
  symbol: string;
  qty: number;
  price: number; // 닫는 예상가
  fee: number;
  expiresAt: string;
  source: "truemarkets" | "estimate";
};

/** 열려 있는 레버리지 포지션(데모: localStorage) */
export type Position = {
  id: string;
  symbol: string;
  side: "long" | "short";
  leverage: number;
  margin: number;
  qty: number;
  entry: number;
  liqPrice: number;
  openedAt: string;
  mode: "demo" | "live";
};
