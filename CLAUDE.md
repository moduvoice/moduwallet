# truemarkets

DevSpot의 True Markets Gateway API 해커톤(4주, 1등 $1,000) 참가 프로젝트.

- 앱 이름 moduwallet, 공개 저장소 https://github.com/moduvoice/moduwallet (main)
- 구상·화면: `docs/concept.md`
- 평가·대회 요약: `docs/evaluation.md` (공개 저장소 제외 - .gitignore)
- MetaMask 스크린샷: `etc/ref/metamask/` (공개 저장소 제외)
- 범위: True Markets 지갑만(자체 시드 지갑·Polymarket 거래 없음). Polymarket 은 공개 데이터만 읽음. Builder 신청함(2026-11-15)
- API 문서: https://docs.truemarkets.co/gateway (색인: https://docs.truemarkets.co/llms.txt)
- 콘솔: https://console.truemarkets.co
- 샌드박스가 없어 모든 주문이 실제 온체인 거래다. 주문 코드는 소액으로만 시험한다.
- API 키·signer 키는 `D:\credentials.env` 에만 둔다(커밋 금지).
