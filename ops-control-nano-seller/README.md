# Ops Control HQ Nano Seller Endpoint

Live pay-per-call npm package health and maintenance-risk API, payable directly in Nano via x402.

## Live service

- Paid endpoint: `GET https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/nano-npm-risk/v1/npm-risk?package=react`
- Free health check: `GET https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/nano-npm-risk/healthz`
- Scheme: `exact`
- Network: `nano:mainnet`
- Price: `0.001 XNO` per successful report
- Facilitator: `https://facilitator.pursekeeper.dev`
- Public receive address: `nano_3mr761i87o7o33hmrd67a1emt81j6djgdqeyod95ip5qcidz77b71x4ukqea`
- Verified seller directory: https://pursekeeper.dev/sellers

An unpaid request for a syntactically valid package returns HTTP 402 with a `PAYMENT-REQUIRED` x402 quote. A valid payment is verified, the requested npm report is prepared, and only then is the Nano payment settled and the JSON report returned. Malformed or missing package names are rejected before any payment challenge; package-not-found or upstream npm metadata failures are returned without settling an already-verified payment.

The report uses public npm registry metadata and npm weekly download counts to surface version recency, maintainers, downloads, license/repository presence, deprecation state, risk flags, and a simple maintenance-health score. It is a heuristic package-health report, not a security audit.

The service does not hold a Nano seed/private key. Its payment-taking source is public in [index.ts](./index.ts).

## Caller quick start

1. Inspect the free health route or the unpaid quote. These requests spend nothing.
2. Use an existing Nano-capable x402 v2 client to authorize the exact live quote.
3. Repeat the same resource request with the client's `PAYMENT-SIGNATURE` header. Read the report and the `PAYMENT-RESPONSE` settlement receipt.

```sh
curl -i 'https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/nano-npm-risk/v1/npm-risk?package=react'
```

Scoped package names are supported; encode the query value, for example `package=%40x402%2Fcore`. Always use the payment terms in the current challenge. Do not send a separate transfer and assume its hash is a supported payment header: this endpoint takes the full x402 payload.

[OpenAPI 3.1 contract](./openapi.json) · [Raw contract for tooling](https://raw.githubusercontent.com/Jay44333/startup-credits/ops-control-nano-seller/ops-control-nano-seller/openapi.json)

The contract documents the deployed v6 handler as reviewed on 2026-09-27. It is a static interface description; a successful health check or a valid specification alone does not verify settlement. The existing seller-directory receipt records one paid call made by Pursekeeper during listing verification.

## Response fields

| Field | Meaning |
| --- | --- |
| `package`, `latestVersion` | Requested package and npm's latest dist-tag version |
| `score`, `verdict` | Health score and threshold-based label |
| `flags` | Maintenance signals with severity and available evidence |
| `evidence` | Publish date, age in days, weekly downloads, maintainer count, license, repository |
| `generatedAt` | UTC timestamp when this report was built |
| `methodology` | Source and interpretation limitations |
| `payment` | Settled transaction hash returned by the facilitator |

The score starts at 100 and subtracts 25 per high flag, 12 per medium flag, and 5 per low flag, floored at zero. Scores of 80 or more yield `low-obvious-risk`; 55–79 yield `review`; below 55 yields `high-caution`. A higher score does not establish that a package is secure, appropriate, or free of vulnerabilities.

Signals cover deprecation, publish recency, listed maintainers, very low weekly downloads, and absent license/repository metadata. A failed download-count lookup can produce `weeklyDownloads: null`; missing data must not be interpreted as zero downloads.

## Status handling

| Status | Meaning |
| --- | --- |
| 200 | Paid report delivered; retain the settlement receipt |
| 400 | Missing/malformed package or malformed/failed request processing |
| 402 | Payment quote, rejected payment, or failed settlement; inspect the error and headers |
| 404 | Package not found after payment verification; no settlement |
| 502 | Upstream npm metadata unavailable; no settlement |

The free quote validates the package-name syntax; it does not establish that the package exists. No paid retry should be automatic without checking the previous settlement outcome.

For service questions: opscontrolhq@outlook.com.
