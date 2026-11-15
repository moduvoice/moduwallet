# truemarkets

DevSpot의 True Markets Gateway API 해커톤(4주, 1등 $1,000) 참가 프로젝트.

- 앱 이름 moduwallet, 공개 저장소 https://github.com/moduvoice/moduwallet (main)
- 구상·화면: `docs/concept.md`
- 평가·대회 요약: `docs/evaluation.md` (공개 저장소 제외 - .gitignore)
- MetaMask 스크린샷: `etc/ref/metamask/` (공개 저장소 제외)
- 범위: True Markets 지갑만(자체 시드 지갑·Polymarket 거래 없음). Polymarket 은 공개 데이터만 읽음. Builder 신청함(2026-11-15)
- API 문서: https://docs.truemarkets.co/gateway (색인: https://docs.truemarkets.co/llms.txt)
- 콘솔: https://console.truemarkets.co
- 앱: `jobs/wallet/` (Next.js 16 PWA, Tailwind 4). 실행 `npm run dev` (포트 3100 으로 띄워 씀)
  - 화면 ↔ 서버 약속: `src/lib/types.ts` · `src/lib/client.ts`(화면은 이것만 부름)
  - 서버: `src/lib/server/tm.ts`(인증·종목 묶기·시세·견적), `src/app/api/{stocks,prices,history,quote}`
  - 키: `jobs/wallet/.env.local`(credentials.env 에서 TRUEMARKETS_KEY_ID · _PRIVATE_JWK · _DEMO_SIGNER_PUB 복사, git 제외)
  - 데모 지갑: 브라우저 localStorage, 1,000 USDC 로 시작. 사기=True Markets 실견적, 팔기=현재가 예상(빈 지갑은 팔기 견적 422)
  - 시세 API 는 gateway asset 의 `economic_asset_id` 로 부른다(`id` 는 404)
- 샌드박스가 없어 모든 주문이 실제 온체인 거래다. 주문 코드는 소액으로만 시험한다.
- API 키·signer 키는 `D:\credentials.env` 에만 둔다(커밋 금지).
