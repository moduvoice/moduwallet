# 구상 (2026-11-15, 단순화판)

## 한 줄
단순한 지갑. 예측 확률이 움직이면 그에 맞는 True Markets 주식 매매를 해 주는 "신호"를 골라 따라간다.
해커톤 제출용 웹 데모만 만든다(앱스토어·실서비스 없음).

## 넣는 것 / 안 넣는 것
- 넣음: 지갑(잔고·보유 주식), 신호 목록, 신호 따라하기, True Markets 견적·체결(데모는 견적까지 실제)
- 안 넣음: Polymarket 거래·예측 카드 화면, 자체 시드 지갑, 봇 여러 개·리더보드, 회원가입
- Polymarket 은 화면에 확률 숫자와 출처로만 보임(공개 데이터, 키 없음)

## 신호 = (예측 시장 하나) + (연결 종목) + (규칙)
| 신호 | 예측 시장(예) | 연결 종목 | 규칙 |
|---|---|---|---|
| 실적 기대 | Will Nvidia beat quarterly earnings? (현재 92%) | NVDA | 85% 넘으면 매수, 발표 후 매도 |
| 금리 | Fed Decision in December / How many cuts | QQQ, SPY | 인하 확률이 오르면 매수, 내리면 줄임 |
| 1등 기업 | Largest company end of December | NVDA, MSFT, AAPL… | 확률 1위 종목 보유 |
| 주가 목표 | What will NVDA hit in November? | NVDA | 상승 목표 확률 상승 시 매수 |
- 각 신호 카드: 지금 확률, 지난 30일 확률 그래프, 같은 기간 이 규칙을 따랐을 때 수익(True Markets 시세로 계산)

## 화면 (3개)
1. 지갑: 총액, 보유 종목, 따라가는 신호
2. 신호 목록 → 신호 상세(확률·연결 종목·30일 성적)
3. 따라하기 시트: 경고문 → 금액 → [따라하기] → True Markets 견적 표시 → 데모 체결

## 서명
- True Markets 는 서명 키에 한도·정책 기능이 없음(문서 Wallet control). 키 보관 방식은 사용자별로
  "서버가 보관" / "사용자 기기가 보관" 중 고름
- 데모: 사용자별 키를 서버가 보관 → 신호가 조건을 넘으면 서버가 자동 주문. 한도(금액)는 우리 서버가 지킴
- 발표: "실서비스에선 사용자 기기 키로 바꾸고, 신호가 오면 알림 → 한 번 눌러 승인"이라고 설명

## 데이터 (2026-11-15 확인)
- True Markets 시세: `GET /v1/defi/market/prices/history?asset_id=<economic_asset_id>&window=12M&resolution=1d`
  - asset_id 는 gateway assets 의 `id` 가 아니라 `economic_asset_id`. window `1y` 는 400, `12M` · `365d` 는 됨
  - NVDA 일봉은 2026-07-03 부터(약 4.5개월). 응답 `points[{t, price}]`
- Polymarket: gamma-api `/events?tag_slug=economy|earnings|stocks` → `markets[].clobTokenIds`
  → clob `/prices-history?market=<token>&interval=max&fidelity=60`
  - interval=max 로 최근 약 1개월(시간 단위)만 옴. 실적 시장은 발표 2주 전쯤 열림
- 견적: 잔고 없이 주문 생성하면 quote(qty_out·fee) 옴. 수수료 0.2%
