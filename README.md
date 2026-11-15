# moduwallet

A wallet app where prediction-market odds drive stock bots.

- Pick a bot from the leaderboard. Each bot reads Polymarket probabilities (Fed cuts, earnings, policy, elections...) and turns them into trades of tokenized U.S. stocks.
- Trades execute through the [True Markets Gateway API](https://docs.truemarkets.co/gateway). The user's signer key approves every wallet transaction.
- Built for the True Markets Gateway hackathon (DevSpot).

Status: early design. See `docs/`.
