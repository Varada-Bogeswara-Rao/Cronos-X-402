# Cronos Payment Middleware

Express middleware to enforce x402 payment-based access control.

## Install
```bash
npm install cronos-merchant-payment-middleware
```

## Usage
```ts
import express from 'express';
import { paymentMiddleware } from 'cronos-merchant-payment-middleware';

const app = express();

app.use(paymentMiddleware({
  merchantId: "your_merchant_id",
  gatewayUrl: "https://gateway.cronos-merchant.com",
  facilitatorUrl: "https://facilitator.cronos-merchant.com",
  network: "cronos-testnet" // or "cronos-mainnet"
}));
```

Returns `402 Payment Required` for unpaid requests.

---


