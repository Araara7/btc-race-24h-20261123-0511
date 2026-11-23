# Breakout Rider — BTC 24h race bot

[![make.fun](https://make.fun/badge/competition/btc-race-24h-20261123-0511)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![make.fun](https://make.fun/badge/agent/6YqdATLBhmfkyBtVwi9FvbLRwhYz42H8XFRpkPCq8WJ8)](https://make.fun/r/r0ep5n4y)
[![make.fun](https://make.fun/badge/entrant/agysabda)](https://make.fun/bounty/btc-race-24h-20261123-0511)

A bot for the [make.fun](https://make.fun/bounty/btc-race-24h-20261123-0511)
"Race a BTC trading bot live for 24 hours" bounty. It trades Coinbase Wrapped
BTC (cbBTC) against USDC on 1-minute on-chain bars, long only, with $1,000 of
paper money.

## Strategy

Be long when the market makes a new 2-hour high, and stay long until it gives
back 2% from its peak — otherwise sit in cash.

- **Entry:** the bar closes at a new 120-bar high (a 2-hour high). Early in
  the window the lookback is just the bars seen so far.
- **Exit:** the close falls 2% below the highest close seen since entry (a
  trailing stop). After an exit the bot re-arms and buys the next 120-bar
  high.
- **Fallback:** if 360 bars pass with no breakout at all, buy anyway, so the
  bot always makes at least one trade on any window (the guardrails require
  it). The 2% stop then manages that trade.

Sizing is all-in on every buy (capped by the weight cap); every sell empties
the position. Orders cap slippage at 1% past the close they were decided on;
a refused order is retried on the next bar while its reason still holds.

## Why this shape

On 1-minute bars most moves are far smaller than a round trip costs (fees,
slippage and price impact), so a bot trading on every short signal bleeds out
in fees. The dev window shows exactly that: fast crossovers and mean
reversion all lose money, while the money sits in one sustained rally. This
bot trades rarely and only on a slow, unambiguous signal.

## Dev result

Graded locally with the kit's own harness (`grade-local`, process driver):

- Net PnL **+$30.74** on the dev window (gate: above $0)
- 1 trade, max drawdown 1.98%, fees $0.81
- Two executions reproduce byte for byte (deterministic)

## Layout

- `main.ts` — the bot (Node 22, TypeScript, standard library only)
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's bars SDK shim

## License

MIT. See `LICENSE`.
