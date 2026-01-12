# 🤖 Developer Integration Guide

This SDK supports two integration patterns:
1.  **Standalone Mode**: For high-speed scripts, trading bots, and scrapers.
2.  **AI Agent Mode**: For LLM-based agents (checking balances, natural language tasks) using the Cronos AI SDK.

---

## Pattern 1: Standalone Mode (No AI)
**Best for:** Trading bots, data scrapers, arbitrage scripts.
**Goal:** Speed and direct control.

### The Code
```typescript
import { AgentClient } from "@cronos-merchant/sdk";

async function main() {
    // 1. Initialize the Client
    const agent = new AgentClient({
        privateKey: process.env.PRIVATE_KEY,
        rpcUrl: "https://evm.cronos.org",
        chainId: 25,
        usdcAddress: "0x...", 
        dailyLimit: 10.0, // Safety Rule: Max $10/day
    });

    console.log("🤖 Bot started. Address:", agent.getAddress());

    // 2. Fetch Data (Auto-Pay)
    // The SDK handles 402 errors, payments, and retries automatically.
    try {
        const marketData = await agent.fetch("https://api.merchant.com/premium-feed");
        console.log("✅ Got Premium Data:", marketData);
    } catch (err) {
        console.error("❌ Failed:", err.message);
    }
}
```

---

## Pattern 2: AI Agent Mode (With Cronos AI SDK)
**Best for:** Chatbots, Personal Assistants, Autonomous Research Agents.
**Goal:** Giving your AI "Hands" to pay for things.

### The Code
```typescript
import { CronosAgent } from "@cronos-labs/ai-sdk"; 
import { AgentClient } from "@cronos-merchant/sdk";
import { createPaymentTool } from "@cronos-merchant/sdk/integrations/CronosAiTool";

async function main() {
    // 1. Setup Your Payment Layer (The Wallet)
    const myWallet = new AgentClient({
        privateKey: process.env.PRIVATE_KEY,
        rpcUrl: "https://evm.cronos.org",
        chainId: 25,
        usdcAddress: "0x...",
        dailyLimit: 50.0 
    });

    // 2. Setup The AI Brain (Cronos Agent)
    const bot = new CronosAgent({
        name: "ResearchAssistant",
        model: "gpt-4-turbo",
        systemPrompt: "You are a helpful assistant. If you need paid data, use the payment tool."
    });

    // 3. Register the Tool 🔌
    // This gives the LLM the ability to "Pay for Resources"
    bot.registerTool(createPaymentTool(myWallet));

    // 4. Run Identity
    // User: "Go get the latest Alpha Report from crypto-news.com"
    // AI: *Reasons that this url requires payment* -> *Calls tool* -> *Wallet checks limit* -> *Pays*
    const response = await bot.run("Get the report from https://api.merchant.com/alpha-report");
    
    console.log("🤖 Agent Response:", response);
}
```

## Summary of Changes
| Feature | Standalone | With Cronos AI SDK |
| :--- | :--- | :--- |
| **Imports** | `AgentClient` only | `AgentClient` + `createPaymentTool` |
| **Usage** | Direct `agent.fetch()` calls | `bot.registerTool(...)` |
| **Logic** | You write the logic | LLM decides when to call it |

---

## Migration Case Study: Solana to Cronos
> Based on a real hackathon submission.

This SDK was designed to replace complex, chain-specific payment logic with a single `agent.fetch()` call. Below is a comparison from a project that migrated a "Pay-Per-Prompt" terminal from manual Solana transactions to the autonomous Cronos Agent SDK.

### Before: Manual Chain Logic (Solana)
The developer had to import `web3.js`, manually parse 402 errors, build transactions, sign them, and retry.
```typescript
// ❌ COMPLEX: Manual Transaction Handling
import { Connection, Transaction, SystemProgram } from "@solana/web3.js";

try {
    await axios.post(url, payload);
} catch (err) {
    if (err.response.status === 402) {
        // 1. Manually parse the payment request
        const { receiver, amount } = err.response.data.paymentRequest;
        
        // 2. Build Transaction manually
        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: new PublicKey(receiver),
                lamports: amount
            })
        );
        
        // 3. Sign & Retry
        tx.sign(wallet);
        await axios.post(url, payload, {
            headers: { "x-payment-proof": tx.serialize().toString("base64") }
        });
    }
}
```

### After: Cronos Agent SDK
The developer replaced ~50 lines of payment logic with the standard SDK usage. The SDK handles policy checks, chain selection (Cronos), signing, and retries automatically.
```typescript
// ✅ SIMPLE: Autonomous Agent
// agent is initialized with { chainId: 338, privateKey: "..." }

// The SDK handles 402, auto-signs with the configured wallet, and retries.
const response = await agent.fetch(url, {
    method: "POST",
    body: JSON.stringify({ prompt, model })
});
```
