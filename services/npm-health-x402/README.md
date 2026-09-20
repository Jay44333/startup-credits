# Ops Control HQ — NPM Health x402 API

Machine-payable npm package health snapshots for buyer agents.

This service exposes a free healthcheck/sample plus a protected `/api/npm-health?package=<name>` route priced at $0.01 USDC on Base via x402.

Deployment target: Railway. The production service is intentionally isolated from the main startup-credits application and uses a dedicated deployment branch.
