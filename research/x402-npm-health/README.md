# Ops Control HQ npm Health Snapshot — x402

Live machine-payable endpoint operated by Ops Control HQ.

## Endpoint

`GET https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/npm-health-x402-v2?package=react`

Replace `react` with another valid npm package name, including scoped names such as `@scope/name`.

## Payment contract

- Protocol: x402 v2
- Scheme: `exact`
- Network: Base mainnet (`eip155:8453`)
- Asset: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Price: 10,000 atomic USDC = $0.01 per call
- Pay-to: `0xf200174de10c26ce7670aaf41d69a8979fe5629d`
- Current facilitator: `https://facilitator.payai.network`

An unpaid request returns HTTP `402` with a base64-encoded x402 v2 `PAYMENT-REQUIRED` header. The challenge includes the Base network, exact USDC asset, price, pay-to address, timeout, and EIP-712 token-domain metadata.

## Output

After successful payment, the endpoint returns deterministic JSON derived from public npm Registry metadata and the npm weekly-download API, including:

- package name
- current `latest` version
- publication timestamp and age
- weekly downloads
- maintainer count
- dependency and dev-dependency counts
- license
- deprecation status/message
- repository/homepage when present
- bounded heuristic `riskScore` and explicit flags
- UTC check timestamp

The risk score is an operational heuristic, not a security audit or vulnerability scan.

## Example unpaid probe

```bash
curl -i 'https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/npm-health-x402-v2?package=react'
```

Expected pre-payment behavior: HTTP `402 Payment Required` plus the `PAYMENT-REQUIRED` header.

## Directory verification

402 Index independently probed this endpoint and accepted it for review as service ID:

`4bb84a9b-89db-453f-b51b-6afa035a75dd`

Their probe observed x402 version 2, Base mainnet, USDC, amount `10000`, the same pay-to wallet above, and a healthy HTTP 402 response. Directory approval remains a separate manual-review state and should not be treated as a sale or payment.
