# Cronos Merchant Payment Middleware (x402)

Turn any Express API into a paid, on-chain–verified endpoint using the **x402 payment protocol** on Cronos.

This middleware enforces **402 Payment Required** semantics, verifies on-chain payments via a trusted Facilitator, and attaches a verified payment receipt to the request — all with one line of code.

## ✨ What This Does

- 💰 **Converts normal APIs into paid APIs**
- 🔐 **Enforces on-chain payment verification**
- 🔁 **Prevents replay attacks** using nonce binding
- 🤖 **Works seamlessly with AI agents**
- 🧱 **Abstracts blockchain complexity** away from merchants
- ⚡ **Lightweight, framework-native** Express middleware

---

## How It Works (High Level)

1. **Client** calls your API
2. **Middleware** checks the price via the Gateway
3. If unpaid → returns **402 Payment Required** with payment instructions
4. **Client** submits on-chain payment (USDC / CRO)
5. **Client** retries request with `txHash` + `nonce`
6. **Middleware** verifies payment via Facilitator
7. Request proceeds with `req.payment` attached

---

## 📦 Installation

```bash
npm install cronos-merchant-payment-middleware
```

---

## 🚀 Quick Start

```typescript
import express from "express";
import { paymentMiddleware } from "cronos-merchant-payment-middleware";

const app = express();

app.use(
  paymentMiddleware({
    merchantId: "merchant_123",
    gatewayUrl: "https://your-gateway.domain",
    facilitatorUrl: "https://your-facilitator.domain",
    network: "cronos-testnet"
  })
);

app.get("/premium-data", (req, res) => {
  res.json({
    message: "Paid access granted",
    payment: req.payment
  });
});

app.listen(3000);
```

---

## 🔐 Payment Receipt

After successful verification, the middleware injects a trusted payment receipt into the request.

```typescript
interface PaymentReceipt {
  txHash: string;
  payer: string;     // Derived from chain (never trusted from headers)
  amount: number;
  currency: string;
}
```

**Usage:**
```typescript
const receipt = req.payment;
console.log(receipt.txHash);
```

---

## ⚠️ 402 Payment Required Response

When payment is missing or invalid, the middleware responds with:

**HTTP Status**
`402 Payment Required`

**Headers** (discoverable by agents & browsers)
```http
X-Payment-Required: true
X-Payment-Amount: 1.5
X-Payment-Currency: USDC
X-Payment-Network: cronos-testnet
X-Payment-PayTo: 0xMerchantWallet
X-Merchant-ID: merchant_123
X-Facilitator-URL: https://facilitator.domain
X-Nonce: abc123...
X-Chain-ID: 338
X-Route: GET /premium-data
```

**JSON Body**
```json
{
  "error": "PAYMENT_REQUIRED",
  "message": "Payment required. Sign and broadcast transaction with provided nonce.",
  "paymentRequest": {
    "chainId": 338,
    "merchantId": "merchant_123",
    "amount": 1.5,
    "currency": "USDC",
    "payTo": "0xMerchantWallet",
    "nonce": "abc123",
    "route": "GET /premium-data"
  }
}
```

---

## 🔁 Replay Protection (Critical)

This middleware enforces strict replay protection:

1. Every payment request includes a **nonce**
2. The Facilitator binds: `merchantId + method + path + nonce`
3. Reusing a transaction or nonce results in: `402 REPLAY_DETECTED`

> ⚠️ **Nonce must match the transaction** — the middleware never mutates it after payment starts.

---

## 🧠 Fail Mode (Merchant Safety)

You can choose how your API behaves if the Gateway or Facilitator is unreachable.

```typescript
failMode?: "open" | "closed";
```

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Default** (`closed`) | API is blocked if payment cannot be verified | Safest option (recommended) |
| **Optional** (`open`) | API continues if the payment infrastructure is temporarily unavailable | Protects merchant uptime during outages |

**Configuration:**
```typescript
interface PaymentMiddlewareConfig {
  merchantId: string;
  gatewayUrl: string;
  facilitatorUrl: string;
  network: "cronos-mainnet" | "cronos-testnet";

  // Optional
  cacheTTLms?: number;       // Default: 30s
  failMode?: "open" | "closed"; // Default: closed
}
```

---

## 🌐 Browser & CORS Support

All required payment headers are exposed automatically:

```http
Access-Control-Expose-Headers:
x-nonce,
x-payment-required,
x-payment-amount,
x-payment-currency,
x-payment-payto,
x-merchant-id,
x-facilitator-url,
x-chain-id,
x-route
```

Works seamlessly with:
- Browsers
- Agent SDKs
- Server-to-server calls

---

## ⚡ Performance Notes

- Price checks are cached in memory (default: 30s)
- Retry logic handles transient network failures
- Designed for low overhead, high throughput

> ⚠️ For clustered deployments (PM2 / Kubernetes), consider a shared cache strategy.

---

## 🧪 Supported Payments

| Asset | Network |
|-------|---------|
| **USDC** | Cronos |
| **CRO / TCRO** | Cronos |

---

## 🔒 Security Guarantees

- ✔ **No trust in client-supplied payer**
- ✔ **On-chain verification only**
- ✔ **Replay-safe**
- ✔ **Route-bound payments**
- ✔ **Merchant-bound payments**
- ✔ **Fail-closed by default**

---

## 🧩 Who Is This For?

- **API Providers** who want instant monetization
- **AI Agents** that pay for data/tools autonomously
- **Web2 Developers** who don’t want to touch blockchain logic
- **Hackathon teams** building agent economies

---

## 🧠 Philosophy

1. Merchants shouldn’t learn crypto to get paid.
2. Agents shouldn’t care how APIs are billed.
3. Protocols should be invisible when they work.

This middleware exists to make that true.

---

## 📄 License

MIT
