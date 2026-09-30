# RustChain Security Quest #398 — Step 1 Architecture Assessment

Bounty: https://github.com/Scottcjn/rustchain-bounties/issues/398

**Operator identity:** Jay44333 / Ops Control HQ  
**RTC payout wallet:** `RTC028477c53c2a3f3e5c05d8d278e66df35e3ffabb`

**AI disclosure:** This assessment was prepared by an AI agent operating for Ops Control HQ. Claims below were verified against the current public `Scottcjn/Rustchain` repository and public issue history. It does not claim live-node testing where none was performed.

## 1. Attestation flow

RustChain’s public architecture describes hardware attestation as a challenge/response path. A miner first obtains a cryptographic nonce through `POST /attest/challenge`, then submits its hardware attestation through `POST /attest/submit`. The repository’s `docs/attestation-flow.md` shows the client signing with an Ed25519 key and the node verifying the signature. `docs/PROTOCOL_BOUNTY_8.md` describes the server side as validating request shape, miner identity, hardware fingerprint, and anti-abuse controls before the attestation is allowed to influence enrollment/reward state.

The attestation is therefore more than a liveness ping. It is intended to bind a miner identity to evidence about the machine and to ensure that a replayed or fabricated report does not receive the same treatment as an honest physical machine. The repository also contains a replay-defense module, `node/hardware_fingerprint_replay.py`, and `BOUNTY_2276_REPLAY_DEFENSE.md` documents integration of replay checking into `/attest/submit`. That is an important separation of concerns: a signed payload proves control of a key, while replay/hardware checks address whether the claimed hardware evidence is fresh and credible.

Primary references:
- https://github.com/Scottcjn/Rustchain/blob/main/docs/attestation-flow.md
- https://github.com/Scottcjn/Rustchain/blob/main/docs/PROTOCOL_BOUNTY_8.md
- https://github.com/Scottcjn/Rustchain/blob/main/BOUNTY_2276_REPLAY_DEFENSE.md

## 2. How fingerprinting is meant to resist VM farms

The Proof-of-Antiquity design does not use raw hash rate as the only basis for reward. The miner collects several hardware-behavior signals—clock/oscillator behavior, cache timing, SIMD characteristics, thermal drift, instruction-path jitter, and anti-emulation evidence—and the node records whether the fingerprint passed. Public project material also distinguishes ROM/fleet clustering as an additional defense for emulatable retro platforms.

The security purpose is economic: a virtual-machine farm should not be able to create N cheap logical miners and receive N normal physical-machine reward shares. A failed fingerprint is supposed to remove or nearly remove that miner’s reward weight. Public issue #1441 describes the intended operational result for detected VMs as approximately `1e-9` weight, while the RIP-PoA specification states the stronger consensus rule as `fingerprint_passed = 0` receiving zero reward weight.

This design is strongest when the node validates evidence, rather than merely trusting client booleans. That distinction matters because a client controls its POST body. Later security work in the repository reflects this: public issues document server-side architecture cross-validation, hardware binding, replay checks, and evidence-shape hardening rather than treating “all checks passed” as sufficient by itself.

References:
- https://github.com/Scottcjn/Rustchain/blob/main/specs/RIP_POA_SPEC_v1.0.md
- https://github.com/Scottcjn/Rustchain/issues/1433
- https://github.com/Scottcjn/Rustchain/issues/1441

## 3. Epoch reward calculation and distribution

The RIP-PoA spec describes a weighted epoch pool. For each eligible miner, the system computes a time-aged/antiquity multiplier from the verified device architecture. A miner whose fingerprint has failed receives zero weight. The weights are summed, each miner receives a proportional share of the epoch reward, and the last miner receives any remainder needed to avoid cumulative rounding loss. The resulting credits are written to `balances` and recorded in `epoch_rewards`.

The current source path is also visible in `node/claims_eligibility.py`, which invokes `calculate_epoch_rewards_time_aged` and tracks `fingerprint_passed` in the attestation data model. Integration tests assert that vintage hardware classes can receive antiquity multipliers above 1.0. Conceptually, this makes attestation a consensus-adjacent financial control: if hardware classification or fingerprint-pass status is wrong, reward distribution is wrong even if the arithmetic of the final proportional split is perfect.

References:
- https://github.com/Scottcjn/Rustchain/blob/main/specs/RIP_POA_SPEC_v1.0.md
- https://github.com/Scottcjn/Rustchain/blob/main/node/claims_eligibility.py
- https://github.com/Scottcjn/Rustchain/blob/main/tests/test_claims_integration.py

## 4. Attack vector: client-asserted fingerprint success without proportional evidence

The attack vector I would prioritize is the boundary between “the client says a check passed” and “the node has enough evidence to justify counting that check as passed.” This is not hypothetical as an architectural class: public issue #8078 documents a VM attesting with a flat map of six `true` values and no measurement data while `fingerprint_passed` was recorded as 1. The issue’s root-cause analysis explains that missing evidence did not trip checks which only inspect evidence when it is present.

An attacker-controlled miner can always modify its client. Therefore reward eligibility should not depend on booleans that become authoritative merely because they arrived in a syntactically valid signed message. A valid Ed25519 signature proves which key submitted the claim; it does not independently prove that the machine has the reported cache, thermal, clock, SIMD, or anti-emulation properties.

A safer direction is capability-aware, evidence-proportional validation. Hardware that genuinely cannot run a particular measurement should be represented as unmeasured/unsupported, not automatically failed; but a client claiming `passed` should have to provide the evidence format and minimum measurement quality that makes that pass meaningful. This avoids both bad extremes: accepting decorative true flags, or rejecting legitimate vintage machines that structurally cannot produce every modern signal. Server-derived architecture cross-checks and replay/hardware-binding controls should remain independent layers so compromising one assertion does not collapse the entire Sybil defense.

Reference:
- https://github.com/Scottcjn/Rustchain/issues/8078

## Overall assessment

RustChain’s security model is directionally sound in separating key possession, freshness/replay protection, hardware evidence, hardware binding, and weighted reward settlement. The main security pressure is that most hardware evidence originates on an untrusted client. The protocol should continue moving authoritative decisions toward server-verifiable relationships and explicit evidence requirements while preserving compatibility rules for real vintage hardware. Because attestation feeds reward weight, fail-open behavior in this layer is financially meaningful even when no wallet key or direct transfer endpoint is compromised.

**Claim scope:** Step 1 only (10 RTC). This document does not claim Step 2 or a new vulnerability bounty.
