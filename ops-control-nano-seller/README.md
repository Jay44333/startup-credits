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
- Verified seller directory: `https://pursekeeper.dev/sellers`

An unpaid request for a syntactically valid package returns HTTP 402 with a `PAYMENT-REQUIRED` x402 quote. A valid payment is verified, the requested npm report is prepared, and only then is the Nano payment settled and the JSON report returned. Malformed or missing package names are rejected before any payment challenge; package-not-found or upstream npm failures are returned without settling an already-verified payment.

The report uses public npm registry metadata and npm weekly download counts to surface version recency, maintainers, downloads, license/repository presence, deprecation state, risk flags, and a simple maintenance-risk score. It is a heuristic package-health report, not a security audit.

The service does not hold a Nano seed/private key and does not require the operator to self-fund a payment. Its payment-taking source is public in [`index.ts`](./index.ts).
