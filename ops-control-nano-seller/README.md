# Ops Control HQ Nano Seller Endpoint

Public source for the Ops Control HQ x402/Nano seller endpoint used for Pursekeeper seller-credit validation.

- Live endpoint: `https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/nano-npm-risk/v1/npm-risk?package=react`
- Scheme: `exact`
- Network: `nano:mainnet`
- Price: `0.001 XNO`
- Facilitator: `https://facilitator.pursekeeper.dev`
- Public receive address: `nano_3mr761i87o7o33hmrd67a1emt81j6djgdqeyod95ip5qcidz77b71x4ukqea`

An unpaid request returns HTTP 402 and a `PAYMENT-REQUIRED` x402 quote. A valid payment is verified and settled through the Pursekeeper facilitator before the npm maintenance-risk JSON report is delivered.

The service does not hold a Nano seed/private key and does not require the operator to self-fund a payment.
