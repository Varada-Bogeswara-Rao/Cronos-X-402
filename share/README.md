# 📦 Cronos Agent Wallet SDK

**Autonomous Payments for AI Agents**  
The `cronos-agent-wallet` SDK equips AI agents with a crypto wallet and the intelligence to autonomously negotiate and pay for API requests using **USDC on Cronos**. It implements the **x402 protocol** to enable a true machine‑to‑machine economy.

---

## ✨ Features
- **Automatic 402 Payments:** Seamlessly handles `HTTP 402 Payment Required` challenges.  
- **Hybrid Architecture:**  
  - *Off‑Chain:* Fast logic enforcement & state tracking (MongoDB).  
  - *On‑Chain:* Immutable policy anchors & registry for tamper‑proof security.  
- **Security First:**  
  - Zero‑trust payer identity (derived from chain data).  
  - Replay protection with merchantId + route + nonce binding.  
  - Anti‑spoofing validation of payment challenges.  
  - Fail‑safe “closed mode” for maximum safety.  
- **Multi‑Chain Support:** Works with Cronos EVM, Solana backends.  
- **Policy Controls:** Daily spending limits, per‑transaction caps, whitelists.  
- **Type‑Safe Fetch:** Strong TypeScript generics and structured error handling.  
- **AI Integration:** Built‑in adapter for LangChain‑compatible frameworks.

### Architecture

```mermaid
graph TD
    subgraph Agent SDK
      Local[Local Policy Engine]
      Anchor[On-Chain Policy Anchor (read-only)]
      Executor[x402 Payment Executor]
    end

    subgraph Merchant Middleware
      MRegistry[Merchant Registry (read-only)]
      Verifier[x402 Verification]
    end

    Local -->|Checks Hash| Anchor
    Local -->|Approves| Executor
    Executor -->|Signed Claim| Verifier
    Verifier -->|Verifies Identity| MRegistry
    Verifier -->|Payment Tx| Cronos[Cronos EVM]
```

---

## 🚀 Installation

```bash
npm install cronos-agent-wallet
```

---

## 🔧 Quick Start

```typescript
import { AgentClient, AgentAdmin, AgentError } from "cronos-agent-wallet";

const CONFIG = {
  key: process.env.AGENT_KEY,
  rpc: "https://evm-t3.cronos.org",
  chainId: 338,
  usdc: "0xc01...", // USDC contract address
  limits: { daily: 10, perTx: 1 },
  analyticsUrl: "https://your-analytics.com/api" // Optional logging
};

async function main() {
  try {
    // 1. Seal Policy On-Chain (run once or when limits change)
    await AgentAdmin.setPolicy(
      { privateKey: CONFIG.key },
      { dailyLimit: CONFIG.limits.daily, maxPerTransaction: CONFIG.limits.perTx }
    );

    // 2. Initialize Agent
    const agent = new AgentClient({
      privateKey: CONFIG.key,
      rpcUrl: CONFIG.rpc,
      chainId: CONFIG.chainId,
      usdcAddress: CONFIG.usdc,
      dailyLimit: CONFIG.limits.daily,
      maxPerTransaction: CONFIG.limits.perTx,
      analyticsUrl: CONFIG.analyticsUrl
    });

    // 3. Fetch paid resources
    const response = await agent.fetch("http://localhost:3000/premium", {
      method: "POST",
      body: { prompt: "Hello World" }
    });

    console.log("Success:", response);
  } catch (err: any) {
    if (err instanceof AgentError)
      console.error(`Error ${err.code}: ${err.message}`);
  }
}
```

---

## 🛡️ Security Workflow (Strict Mode)

1. **Define Limits in Code:** Set daily and per‑transaction limits in `AgentClient`.  
2. **Seal Policy On‑Chain:** Use `AgentAdmin.setPolicy` to commit limits to blockchain.  
3. **Run Agent:**  
   - Local hash of limits is compared to on‑chain hash.  
   - Match → Agent runs.  
   - Mismatch → Agent crashes (fail‑safe).  

---

## 📚 API Reference

### `agent.fetch<T>(url, options): Promise<T>`
- Performs HTTP request.  
- If server responds with `402 Payment Required`:  
  - Parses payment request.  
  - Checks policy (limits, whitelist).  
  - Executes USDC payment on Cronos.  
  - Retries with proof of payment.  

**Options:**
- `method`: `"GET" | "POST"`  
- `headers`: Dictionary of headers  
- `body`: JSON object or string  
- `allowBodyFallback`: Parse 402 details from body if headers missing (dangerous, only for trusted facilitators).  

**Errors:**  
- `POLICY_REJECTED` → blocked by limits/whitelist  
- `INSUFFICIENT_FUNDS` → not enough USDC/gas  
- `HTTP_ERROR` → server returned error  

---

## 🤝 AI Framework Integration

```typescript
import { AgentClient, createPaymentTool } from "cronos-agent-wallet";

const wallet = new AgentClient({ ...config });
const paymentTool = createPaymentTool(wallet);

myAgent.registerTool(paymentTool);
// Tool name: pay_for_resource
// Allows LLMs to autonomously decide when to pay for premium content
```

---

## 📈 Roadmap
- ✅ Cronos USDC payments  
- ✅ LangChain adapter  
- 🔜 Multi‑token support  
- 🔜 Advanced negotiation policies  
- 🔜 Community integrations  

---

## 📜 License
MIT License
