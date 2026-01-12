# Cronos Merchant Dashboard 🛍️

The official frontend for the **Cronos x402 Merchant Gateway**. 
This dashboard enables merchants to monetize their APIs, track sales, and manage access policies for AI agents.

![Dashboard Preview](./public/dashboard-preview.png)

## ⚡ Features

*   **Zero-Key Onboarding**: Register purely with your Cronos wallet signature.
*   **Route Management**: Set pricing (CRO/USDC) for any API endpoint.
*   **Real-Time Analytics**: Monitor agent payment attempts and successful unlocks.
*   **Sandbox**: Test your paid routes instantly via the built-in gateway proxy.
*   **Integration Guide**: Auto-generated snippet to drop into your Express/Next.js backend.

## 🛠️ Tech Stack

*   **Framework**: Next.js 14 (App Router)
*   **Styling**: TailwindCSS + "Liquid Glass" UI
*   **Web3**: Wagmi v2 + Viem (Cronos Testnet)
*   **State**: React Query + Zustand

## 🚀 Getting Started

### 1. Environment Setup
Copy `.env.example` to `.env.local`:
```bash
NEXT_PUBLIC_GATEWAY_URL="http://localhost:5000" # Your backend
NEXT_PUBLIC_NETWORK="cronos-testnet"
```

### 2. Install & Run
```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## 📦 Deployment (Vercel/Railway)

1.  Set `NEXT_PUBLIC_GATEWAY_URL` to your production backend (e.g., `https://cronos-x-402-production.up.railway.app`).
2.  Set `NEXT_PUBLIC_NETWORK` to `cronos-testnet`.
3.  Deploy!

## 🔐 Security

*   **No API Keys**: Authentication is handled via wallet signatures (`SIWE`-style).
*   **Replay Protection**: All updates require a signed message with `nonce` + `timestamp` + `expiresAt`.

## 🤝 Contributing

Run the linter before pushing:
```bash
npm run lint
```
