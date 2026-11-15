# moduwallet

**Easy U.S. stocks, in a clean wallet.** A mobile-first PWA that lets anyone buy tokenized U.S. stocks and use simple, explained leverage, built on the [True Markets Gateway API](https://docs.truemarkets.co/gateway).

- Live demo: https://agreeable-grass-01185c300.3.azurestaticapps.net (open on a phone, then "Add to Home Screen")
- Languages: English, 한국어, 简体中文, ไทย, Tiếng Việt, Русский (follows your browser, switch with the globe button)

## What it does

- **Wallet home**: balance, today's change, holdings, local-currency hint (₩, ₫, ฿, ¥, ₽).
- **94 tokenized stocks & ETFs + BTC/ETH/SOL**: the same stock listed on several chains (Robinhood, Coinbase/Base, xStocks/Solana) is grouped into one, routed to the best listing.
- **Buy and sell in dollars or shares**: one sheet, one keypad. Amounts over the limit snap to the maximum. Every order shows a **real-time True Markets quote** (`POST /v1/gateway/quotes`) with the fee and the buy/sell spread explained.
- **Leverage, made simple**: 18 perpetual markets (NVIDIA, Tesla, SK hynix, S&P 500, oil, silver, BTC...). Instead of jargon: *"It'll go up / It'll go down"*, *"If NVIDIA falls about 17.5%, you lose everything you put in"*, a scenario table, a one-time risk check, and a liquidation meter on each position.
- **Activity** with realized P&L and fees, **Terms & risks** page, offline and stale-price indicators, US market-hours status.

## True Markets integration

| Feature | API |
|---|---|
| Asset catalog (spot, stocks, perps) | `GET /v1/gateway/assets` (`asset_class=crypto,stock`, `product_type=perp`) |
| Prices, 24h change, charts | Market data `GET /v1/defi/market/prices/history(/batch)` (by `economic_asset_id`; `asset_class=perp` for perps) |
| Org auth | `POST /v1/auth/api-key/token` (ES256 over `{key_id}.{timestamp}`) |
| Users & wallets | `POST /v1/account/organizations/{org}/users` |
| Quotes (buy by USD, sell by qty, perps with leverage) | `POST /v1/gateway/quotes` |

**Demo mode**: quotes and prices are real; fills are simulated in the browser (each visitor starts with 1,000 USDC). The server is ready to point at the UAT/paper-trading environment (`TRUEMARKETS_API`) for end-to-end order execution once a UAT key is available. No real money moves.

## Run locally

```bash
cd jobs/wallet
npm install
# .env.local: TRUEMARKETS_KEY_ID, TRUEMARKETS_PRIVATE_JWK (JSON), TRUEMARKETS_DEMO_SIGNER_PUB
npm run dev
```

Stack: Next.js 16 (App Router, PWA), Tailwind CSS 4, TypeScript. Deployed on Azure Static Web Apps.

Built for the True Markets Gateway hackathon on DevSpot. Not investment advice. Not available to U.S. persons.
