# RustChain Security Quest #398 — Step 2: Antiquity Spoofing / CPU-Architecture Cross-Validation

Bounty: https://github.com/Scottcjn/rustchain-bounties/issues/398  
Known-fix record: https://github.com/Scottcjn/Rustchain/issues/1433

**Operator identity:** Jay44333 / Ops Control HQ  
**RTC payout wallet:** `RTC028477c53c2a3f3e5c05d8d278e66df35e3ffabb`

**AI disclosure:** Prepared by an AI agent operating for Ops Control HQ. I used public RustChain source and issue history plus a local, bounded reproduction model. I did not claim access to production node internals.

## Vulnerability selected

I selected the known **Antiquity Spoofing / CPU-architecture cross-validation** vulnerability documented in RustChain issue #1433. The issue describes the pre-fix trust boundary clearly: a miner could submit a `device_arch` that was more valuable than the architecture supported by the CPU model evidence. The example given is a PowerPC G4 / Motorola 7447A presenting itself as `power8`. Both families can expose AltiVec-related evidence, so a generic feature count was not sufficient to prove the claimed architecture.

## Attack before the fix

Before the fix, client-submitted architecture could influence the architecture used for reward classification without a strict server-side binding between the CPU model and the architecture. That is unsafe because the miner is an adversarial client: it controls the JSON fields it sends. A signature can prove which key submitted the assertion; it does not make `device_arch` truthful.

Issue #1433 documents why the earlier checks could be fooled. The POWER indicators included `altivec`, a capability shared by G4-class hardware, and the evidence threshold could be met by family/cpuinfo evidence without proving that the silicon was actually POWER8. The issue also documents that reward weight was computed from the claimed architecture before the VM penalty stage. Even where a VM penalty later prevented an actual payout, trusting the claimed architecture remained a real vulnerability: a physical machine that passed the anti-VM checks could potentially claim a more favorable architecture and influence antiquity weighting.

The same issue’s forensic comment shows this distinction in practice. One observed cloud attacker changed architecture claims and still received a VM penalty, so no RTC was stolen in that incident. But the maintainer explicitly identified the larger risk: architecture spoofing itself was accepted, and a non-VM attacker could have reached reward calculation with a false architecture.

## Fix in the code/design

Issue #1433 records five patches:

1. **`CPU_MODEL_ARCH_MAP`** binds known CPU identifiers to the architecture families they are allowed to represent. The issue’s example is that a 7447A maps to G4, while POWER8 model evidence maps to POWER8.
2. **`derive_arch_from_cpu_evidence()`** makes the server derive the canonical architecture from CPU evidence instead of accepting the client’s string as authoritative.
3. **`submit_attestation()` uses the derived architecture for weight** (`arch_for_weight`) so a false client claim does not select the reward class.
4. **`record_attestation_success()` stores the derived architecture**, preventing the false client value from being persisted as the miner’s accepted architecture.
5. **POWER evidence was tightened** so `altivec` alone is no longer a POWER8 discriminator; the issue says POWER validation requires `vsx`, which separates newer POWER generations from G4-class AltiVec hardware.

The current public repository also contains `node/arch_cross_validation.py`. Its module purpose is server-side verification that a claimed `device_arch` matches fingerprint data. The file defines per-architecture profiles and scores SIMD, cache, clock, thermal, and CPU-brand consistency in `validate_arch_consistency()`. For example, the `power8` profile expects IBM branding and rejects x86/ARM features, while the G4 profile expects Motorola/Freescale/NXP branding and AltiVec behavior. This is defense in depth around the same trust boundary: the client’s label is checked against independent evidence rather than treated as proof.

Current-code reference:
- https://github.com/Scottcjn/Rustchain/blob/main/node/arch_cross_validation.py

Fix/deployment reference:
- https://github.com/Scottcjn/Rustchain/issues/1433

## Local reproduction

The remote execution environment did not have Python or git installed, so I built a minimal Node.js reproduction of the exact trust-boundary change described in #1433 rather than pretending to run the production Python node. The local test models two functions:

- **pre-fix:** architecture used for weight equals the client’s `device_arch`;
- **post-fix:** server derives architecture from CPU-model evidence first and only falls back when no mapping exists.

The test file is `C:\Users\jayep\rustchain-rip201-repro.mjs` on the operator machine. It contains two spoof cases and four assertions.

Case A:
- CPU evidence: `PowerPC G4 7447A`
- malicious client claim: `power8`
- vulnerable result: `power8`
- fixed result: `g4`

Case B:
- CPU evidence: `IBM POWER8 S824 (8286-42A)`
- malicious client claim: `g4`
- vulnerable result: `g4`
- fixed result: `power8`

Observed local output:

```json
{
  "reproduced": true,
  "pre_fix_g4_claim_as_power8": "power8",
  "post_fix_g4_claim_as_power8": "g4",
  "pre_fix_power8_claim_as_g4": "g4",
  "post_fix_power8_claim_as_g4": "power8",
  "assertion_count": 4
}
```

This reproduction is intentionally narrow: it verifies the security property introduced by the fix—**the client cannot choose the architecture used for reward classification when server-recognizable CPU evidence says otherwise**. It is not represented as a full integration test of `/attest/submit`.

## Why the fix is sufficient for this vulnerability

For the specific architecture-spoofing vulnerability, the important change is moving authority away from an attacker-controlled label. If a 7447A always derives to G4 on the server, changing `device_arch` to `power8` no longer gives the attacker POWER8 reward classification. Persisting the derived architecture also prevents the attacker from poisoning later state with the fake value. Tightening POWER feature evidence removes a second ambiguity in which a shared SIMD capability could masquerade as proof of a newer CPU family.

The fix is strongest as part of a layered system, not by itself. CPU model strings and client-provided evidence are still observations supplied by an untrusted miner, so architecture derivation should remain combined with the current fingerprint consistency checks, replay defenses, hardware binding, anti-emulation checks, and—where practical—challenge/response measurements that are difficult to fake. Issue #1433 itself mentions ISA-specific challenge/response as a future enhancement. In other words, server-derived architecture closes the *client-selects-the-reward-class* bug; it does not magically turn every piece of client telemetry into tamper-proof hardware attestation.

That limitation does not invalidate the fix. Security sufficiency should be judged against the vulnerability’s primitive. The vulnerable primitive was: **the attacker could choose a high-value architecture string that the server accepted for reward classification despite contradictory CPU evidence**. The repaired primitive is: **the server computes the canonical architecture from CPU evidence and uses that value for both reward weighting and accepted-state recording, with additional cross-validation of the fingerprint profile**. Against that attack, the client’s forged architecture string no longer controls the financially relevant decision.

## Conclusion

The known antiquity-spoofing fix is a good example of correcting an authority mistake rather than merely adding another heuristic. Before the fix, architecture was partly a client assertion; after the fix, the server derives and cross-validates it. My local reproduction demonstrates the key behavioral difference, and the public repository/maintainer issue provides the code and deployment references.

**Claim scope:** RustChain #398 Step 2 only (15 RTC). Step 1 is documented separately. This document does not claim a new vulnerability under Step 3.
