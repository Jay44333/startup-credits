# Ops Control HQ x402 APIs

Public machine-buyable APIs operated by Ops Control HQ. Each endpoint uses x402 v2 `exact` payments on Base (`eip155:8453`) and costs **$0.01 USDC per successful paid call**.

## Services

### npm Health Snapshot

- Endpoint: `GET https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/base-npm-health/v1/npm-health?package=react`
- Purpose: deterministic npm package health and maintenance-risk snapshot from public registry metadata and weekly download counts.
- 402 Index: https://402index.io/service/e1f4be31-d20a-43db-a38a-8384c242e582
- Public implementation: ../ops-control-base-x402/index.ts

### JSON Record Reconciliation

- Endpoint: `POST https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/base-data-reconcile/v1/reconcile`
- Purpose: compare shallow JSON record sets by a caller-selected key and report left-only/right-only keys, duplicates, missing-key rows, and changed fields.
- 402 Index: https://402index.io/service/7d7987a2-cfbb-46b8-883c-c50c07b55ab2

### OSV Batch Vulnerability Intelligence

- Endpoint: `POST https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/base-vuln-intel/v1/vulnerability-intel`
- Purpose: exact-version vulnerability-ID lookup backed by OSV.dev, with batch support and explicit truncation metadata.
- 402 Index: https://402index.io/service/16f9d483-789e-43c6-895e-638b39329109
- Public implementation: ../ops-control-base-vuln/index.ts

## Payment terms

- Protocol: x402 v2
- Scheme: `exact`
- Network: Base (`eip155:8453`)
- Asset: USDC
- Price: $0.01 per paid call
- Payment address: `0xf200174de10c26ce7670aaf41d69a8979fe5629d`
- Facilitator: `https://facilitator.payai.network`

An unpaid request returns HTTP `402` with the machine-readable x402 payment requirements. Clients should follow the returned payment challenge rather than hard-coding settlement details from this README.

## Availability

All three services are publicly indexed by 402 Index under provider **Ops Control HQ**. Service health and protocol metadata can be inspected through the listing links above.
