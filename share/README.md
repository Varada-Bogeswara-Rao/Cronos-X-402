# Cronos Merchant SDK

The official SDK for building AI agents that can pay for resources on the Cronos blockchain using the x402 protocol.

## Architecture

This SDK employs a **Hybrid "Exoskeleton" Architecture**:
- **Off-Chain**: Fast, free logic enforcement and state tracking (MongoDB).
- **On-Chain**: Immutable security anchors (Registry & Policy) to prevent tampering.

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

## 🛡️ Security Features (v1.1.1)
- **Zero Trust Payer:** Derives identity strictly from chain data.
- **Strong Replay Protection:** Enforces cryptographic binding of `merchantId + route + nonce`.
- **Anti-Spoofing:** Validates payment challenges against requested routes before paying.
- **Fail-Safe:** Supports "Fail Closed" mode for maximum security.

Key features:
*   **Automatic 402 Payments**: Handles "Payment Required" challenges seamlessly.
*   **Multi-Chain**: Auto-negotiates with backends (EVM/Solana support).
*   **Safe**: Built-in daily spending limits and policy controls.
*   **Type-Safe**: Generic `fetch` and structured `AgentError` handling.

## Installation

```bash
npm install @cronos-merchant/sdk ethers
```

## Quick Start

```typescript
import { AgentClient, AgentAdmin, AgentError } from "@cronos-merchant/sdk";

// Configuration
const CONFIG = {
  key: process.env.AGENT_KEY,
  rpc: "https://evm-t3.cronos.org",
  chainId: 338,
  usdc: "0xc01...",
  limits: { daily: 10, perTx: 1 }
};

async function main() {
  try {
    // 1. [Setup] Seal Policy On-Chain (Run once or on change)
    await AgentAdmin.setPolicy({ privateKey: CONFIG.key }, {
        dailyLimit: CONFIG.limits.daily,
        maxPerTransaction: CONFIG.limits.perTx
    });

    // 2. [Runtime] Initialize Agent
    const agent = new AgentClient({
      privateKey: CONFIG.key,
      rpcUrl: CONFIG.rpc,
      chainId: CONFIG.chainId,
      usdcAddress: CONFIG.usdc,
      dailyLimit: CONFIG.limits.daily,       // Must match setPolicy
      maxPerTransaction: CONFIG.limits.perTx // Must match setPolicy
    });

    // 3. [Usage] Fetch paid resources
    const response = await agent.fetch("http://localhost:3000/premium", {
        method: "POST",
        body: { prompt: "Hello World" }
    });
    
    console.log("Success:", response);

  } catch (err: any) {
    if (err instanceof AgentError) console.error(`Error ${err.code}: ${err.message}`);
  }
}
```

## Configuration

`new AgentClient(config)`

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `privateKey` | `string` | Yes | EVM private key for the agent wallet. |
| `rpcUrl` | `string` | Yes | RPC Endpoint (e.g., Cronos Testnet). |
| `chainId` | `number` | Yes | Chain ID (e.g., 338). Sent to backend for negotiation. |
| `usdcAddress` | `string` | Yes | ERC20 Token Address used for payment. |
| `dailyLimit` | `number` | No | Max USDC allowed to spend per 24h. Default: 1.0. |
| `maxPerTransaction` | `number` | No | Max USDC allowed per single transaction. Default: 0.5. |
| `strictPolicy` | `boolean` | No | If `true`, Agent crashes if local config hash != on-chain hash. Default: `true`. |
| `anchors` | `object` | No | On-chain registry addresses. Auto-filled for Cronos Testnet. |
| `analyticsUrl` | `string` | No | URL for centralized logging of payment decisions (e.g. `https://api.myapp.com/analytics`). |
| `allowedMerchants` | `string[]` | No | List of Merchant IDs to trust. If empty, allows all. |
| `trustedFacilitators` | `string[]` | No | List of Gateway URLs to trust (e.g., localhost). |

## 🛡️ Security Workflow (Strict Mode)

When `strictPolicy` is `true` (default), the Agent **verifies on-chain authority** before starting. This ensures that no one (including a compromised local server) can tamper with spending limits.

**Step 1. Define Limits in Code**
You must set your desired limits in your `AgentClient` (or environment variables).

```typescript
const agent = new AgentClient({
  ...
  dailyLimit: 10,
  maxPerTransaction: 1, // Optional, defaults to 0.5
  ...
});
```

**Step 2. Seal Policy On-Chain**
Use the `AgentAdmin` tool to write these exact limits to the blockchain. This generates a cryptographic hash.

```typescript
import { AgentAdmin } from "@cronos-merchant/sdk";

// Run this ONCE (or whenever you change limits)
await AgentAdmin.setPolicy({
  privateKey: process.env.ADMIN_KEY
}, {
  dailyLimit: 10,      // MUST MATCH AgentClient config
  maxPerTransaction: 1 // MUST MATCH AgentClient config
});
```

**Step 3. Run Agent**
When the Agent starts:
1.  Calculates hash of local `dailyLimit` + `maxPerTransaction`.
2.  Fetches the hash from the On-Chain Registry.
3.  **Matches?** -> Runs.
4.  **Mismatch?** -> Crashes (FAIL-SAFE).

## API Reference

### `agent.fetch<T>(url, options): Promise<T>`

Performs an HTTP request. If the server responds with **402 Payment Required**:
1.  SDK parses the payment request (from Headers or Body).
2.  Checks spending policies (Daily Limit, Whitelist).
3.  Executes the payment on-chain.
4.  Retries the original request with the Payment Proof.

**Generics**:
Pass the expected response type `<T>` for TypeScript autocomplete.

**Options**:
*   `method`: "GET" | "POST"
*   `headers`: Dictionary of headers.
*   `body`: JSON object or string.
*   `allowBodyFallback`: `boolean`. Defaults to `false`. Set to `true` to allow parsing 402 details from the response body if headers are missing. DANGEROUS: Only use with trusted facilitators.

### `AgentError`

Thrown when a request fails or is blocked by policy.

*   `err.status`: The HTTP status code (e.g., 400, 402, 500).
*   `err.code`: A machine-readable string:
    *   `POLICY_REJECTED`: Blocked by daily limit or whitelist.
    *   `INSUFFICIENT_FUNDS`: Not enough USDC/Gas.
    *   `HTTP_ERROR`: Server returned an error (details in `err.details`).
*   `err.details`: The raw response body from the server.

## 🤝 Integration with AI Frameworks

The SDK includes a built-in adapter for LangChain-compatible frameworks (like Cronos AI SDK).

```typescript
import { AgentClient, createPaymentTool } from "@cronos/agent-wallet";

// 1. Setup Wallet
const wallet = new AgentClient({ ...config });

// 2. Create Tool
const paymentTool = createPaymentTool(wallet);

// 3. Register with your Agent
myAgent.registerTool(paymentTool);
```

The tool is named `pay_for_resource`. It allows your LLM to autonomously decide when to pay for premium content.

## License

MIT
