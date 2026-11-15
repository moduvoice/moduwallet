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
  - 배포: Azure Static Web Apps(Free, Next.js 하이브리드) `moduwallet`, 리소스 그룹 `moduwallet`(koreacentral),
    앱 지역 eastasia(SWA 는 한국 리전 없음). 주소 https://agreeable-grass-01185c300.3.azurestaticapps.net
    main 에 push 하면 `.github/workflows/azure-static-web-apps-*.yml` 이 자동 배포. 키 3개는 SWA 앱 설정에 있음
    Node 는 22.x 고정(SWA 는 18·20·22 만, 24 는 실패). next.config `output: "standalone"`
  - 견적은 `POST /v1/gateway/quotes`(잔고 없이 사기·팔기·레버리지 모두). 사기는 qty_unit=quote 만, 팔기는 base 만 받는다. 가끔 503 → 한 번 재시도
  - 레버리지: `src/lib/server/perp.ts`(18종목 고정 목록, 청산가는 유지율 1/(2×최대배율) 근사, 최소 포지션 $10)
  - 다국어: `src/i18n/{ko,en,zh,th,vi,ru}.ts`(ko 가 기준), 기본 = 브라우저 언어 → 영어
  - UAT(모의 체결) 키는 아직 없음 - 지금 키로 api.uat 는 invalid api key. 받으면 TRUEMARKETS_API 로 바꾼다
- 데모 영상: `etc/video/`(record.py 녹화 → compose.py 합치기, 내레이션 moduvoice 관리자 API 의 `ethan` 영어 음성). 결과 `tmp/video/moduwallet-demo.mp4`
  - 시세 API 는 gateway asset 의 `economic_asset_id` 로 부른다(`id` 는 404)
- 샌드박스가 없어 모든 주문이 실제 온체인 거래다. 주문 코드는 소액으로만 시험한다.
- API 키·signer 키는 `D:\credentials.env` 에만 둔다(커밋 금지).
