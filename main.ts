// Breakout rider for the BTC 24h race (bars-replay/v1, one asset: CBBTC).
//
// Idea, in one line: be long when the market makes a new 2-hour high, and stay
// long until it gives back 2% from its peak — otherwise sit in cash.
//
// Why this shape: on 1-minute bars most moves are far smaller than a round
// trip costs (about 26-46 bps in fees, slippage and price impact), so a bot
// that trades on every short signal bleeds out in fees. The dev window shows
// exactly that: fast crossovers and mean reversion all lose money, while the
// money sits in one sustained rally. This bot therefore trades rarely and only
// on a slow, unambiguous signal:
//
//   - Entry: the bar closes at a new 120-bar high (a 2-hour high). Early in
//     the window the lookback is just the bars seen so far, so the first real
//     uptick gets us in; on the dev window that is bar 55.
//   - Exit: the close falls 2% below the highest close seen since entry (a
//     trailing stop). A 2% stop is wide enough to survive the dev window's
//     intraday dips (the deepest was under 1%) while still cutting a real
//     reversal. After an exit the bot re-arms and buys the next 120-bar high.
//   - Fallback: if 360 bars pass with no breakout at all, buy anyway. That
//     guarantees at least one trade on any window, which the guardrails
//     require, at the cost of buying into a flat day — a trade the 2% stop
//     then manages.
//
// Sizing is all-in on every buy, capped by the weight cap, and every sell
// empties the position. Orders cap their slippage at 1% past the close they
// were decided on; a refused order is simply retried on the next bar while
// its reason still holds.
//
// Everything here is integer math (bigint) over the raw price units the
// harness sends, with no clock, no randomness and no state beyond the rolling
// highs, the peak close and a bar counter — so two runs on the same bars
// answer byte for byte the same.

import { BPS, runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** 120 one-minute bars: a 2-hour high. */
const LOOKBACK_BARS = 120;
/** Trailing stop: 200 bps = 2% below the peak close since entry. */
const TRAIL_BPS = 200n;
/** Fallback entry: buy at the latest on the 361st bar if still flat. */
const FALLBACK_BARS = 360;
/** Reject a fill more than 1% past the close the order was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Rolling window of bar highs (raw price units), oldest first. */
const highs: bigint[] = [];
/** Highest close seen since the current entry; 0 when flat. */
let peak = 0n;
/** Bars seen so far (1 on the first batch). */
let barsSeen = 0;

function windowHigh(): bigint {
  let top = 0n;
  for (const h of highs) if (h > top) top = h;
  return top;
}

await runBars({
  onBatch(state, batch) {
    if (state.warmingUp) return [];
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    barsSeen += 1;
    const close = BigInt(bar.c);
    highs.push(BigInt(bar.h));
    if (highs.length > LOOKBACK_BARS) highs.shift();

    const held = state.positions.get(SYMBOL);
    const { caps, fees } = state.hello;

    if (held !== undefined) {
      if (close > peak) peak = close;
      if (close * BPS < peak * (BPS - TRAIL_BPS)) {
        peak = 0n;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    const breakout = close >= windowHigh();
    const fallback = barsSeen > FALLBACK_BARS;
    if (!breakout && !fallback) return [];
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    peak = close;
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
