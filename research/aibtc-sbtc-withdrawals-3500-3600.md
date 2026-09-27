# sBTC withdrawal measurement — request IDs 3500–3600

Bounty: AIBTC `muk2q8eb456c1faac489`  
Contract: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-registry`  
Window: request IDs **3500 through 3600 inclusive**

## Method

I joined the registry's public `withdrawal-create`, `withdrawal-accept`, and
`withdrawal-reject` print events by `request-id`.

Hiro source template:

`https://api.hiro.so/extended/v1/contract/SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-registry/events?limit=50&offset=N`

I paged the settled event stream across the target range and cross-checked the
semantics against the deployed contract source:

- Registry source:
  https://github.com/stacks-network/sbtc/blob/main/contracts/contracts/sbtc-registry.clar
- Withdrawal source:
  https://github.com/stacks-network/sbtc/blob/main/contracts/contracts/sbtc-withdrawal.clar
- Stacks sBTC registry documentation:
  https://docs.stacks.co/learn/sbtc/clarity-contracts/sbtc-registry

The important contract details are:

- `initiate-withdrawal-request` passes `burn-block-height` to
  `create-withdrawal-request`.
- The registry stores that value as the request's `block-height`; its own
  comment calls it the **burn block height where the withdrawal request was
  created**.
- `complete-withdrawal-accept` stores the supplied Bitcoin sweep
  `burn-height`.
- `withdrawal-status[request-id] = true` means accepted; `false` means
  rejected; no entry means pending.
- `accept-withdrawal-request` enforces `fee <= requested-max-fee`.

So the latency subtraction below is **Bitcoin burn blocks to Bitcoin burn
blocks**. It is not a subtraction of a Stacks-chain block height from a Bitcoin
block height.

## 1. Created vs completed

**101 withdrawal requests were created. 97 reached a completed sweep.**

Method: event join. Every ID 3500–3600 has exactly one `withdrawal-create` in
the examined settled history. I count a request as completed only when a
matching `withdrawal-accept` exists. I found 97 accepts.

The remaining four IDs are 3591, 3592, 3593, and 3594; all four have explicit
`withdrawal-reject` events, so there are **0 pending** requests in the window.

I did not find an event-vs-contract disagreement to resolve.

## 2. Latency

For each of the 97 completed requests I calculated:

`accept.burn-height - create.block-height`

Units: **Bitcoin burn blocks**.

Results:

- **minimum: 7 blocks**
- **median: 7 blocks**
- **maximum: 10 blocks**
- mean (not required, included as a check): **7.7010309278 blocks**

Distribution:

| gap (burn blocks) | completed requests |
|---:|---:|
| 7 | 64 |
| 8 | 3 |
| 9 | 25 |
| 10 | 5 |

This matches the protocol flow described in the official sBTC withdrawal
documentation: the signers wait for Bitcoin finality before sweeping, and the
sweep commonly confirms around the next Bitcoin block after that wait.

## 3. Fees vs max-fee

Across the 97 accepted requests:

- **actual fee equaled the request's max-fee: 0 times**
- **actual fee exceeded max-fee: 0 times**
- **largest absolute cap-vs-actual gap: 9,931 sats below the cap**

The largest gap is request **3549**:

- `max-fee = 10,000 sats`
- actual accepted `fee = 69 sats`
- cap minus actual = **9,931 sats**

There is no gap in the other direction in this window. That is also consistent
with `accept-withdrawal-request`, which rejects an acceptance whose fee is
higher than the requested max fee and mints the unused max-fee difference back
to the requester.

## 4. Requests without a completed sweep

Exactly four:

| request-id | outcome | observable |
|---:|---|---|
| 3591 | rejected | `withdrawal-reject` event; contract status becomes `false` |
| 3592 | rejected | `withdrawal-reject` event; contract status becomes `false` |
| 3593 | rejected | `withdrawal-reject` event; contract status becomes `false` |
| 3594 | rejected | `withdrawal-reject` event; contract status becomes `false` |

There are **no still-pending IDs** in this range.

The observable separating rejected from pending is not merely absence of an
accept. `complete-withdrawal-reject` inserts `false` into the registry's
`withdrawal-status` map and emits `withdrawal-reject`. A pending request has
the create record but neither accepted/rejected status (the read-only
`get-withdrawal-request` exposes `status: none`).

Concrete rejection transactions from the event stream:

- 3591 reject Stacks tx:
  `0xd0149dab2c027630c6845a707c40f76f7398207279d7724217c83ed5a6f56295`
- 3592:
  `0xddeab23d3fe7e5286089bfcd240551b5e1902b266aa994f8c6b5323fff09fb15`
- 3593:
  `0x8795acaf19884a8cde1fe9968b6d17297c95b31030d1c1f2e3c4594c1fad416f`
- 3594:
  `0xabd964cddb6f6ca1e4602146b36c1dcc9eb23771259afefd548760845c84f8a8`

## 5. A concrete way this window can mislead

**Request count is not independent Bitcoin cash-out count.**

A striking example is **requests 3500 through 3547**. All 48 accepted requests
point to the *same* Bitcoin sweep transaction:

`0536f3639ff6f6ca11ce228ef9756fe53761fdcdcf28f756a0634ba677aa8021`

They are separate outputs in that one batched sweep (the event rows use output
indexes 10 through 57).

So the correct observation is that the window contains 97 completed withdrawal
**requests**, with on-chain Bitcoin sweep evidence. It would be misleading to
turn that into “97 independent Bitcoin cash-out transactions” or to treat the
97 rows as 97 independent liquidity observations. The protocol batches many
withdrawal requests into one Bitcoin transaction.

That distinction matters to the question “is sBTC cashable?”: this dataset is
direct evidence that sBTC requests were fulfilled into Bitcoin sweep outputs,
but the raw 97/101 completion ratio must not be presented as 97 independent
Bitcoin-side exit events.

## Reproducibility notes

Sanity totals from the joined event window:

- creates: 101
- accepts/completed: 97
- rejects: 4
- pending: 0
- latency histogram: `{7: 64, 8: 3, 9: 25, 10: 5}`
- equal-to-cap fees: 0
- over-cap fees: 0
- largest `(max-fee - fee)`: request 3549, 9,931 sats

No funds were moved and no paid API was used for this measurement.
