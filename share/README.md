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
import { AgentClient, AgentError } from "@cronos-merchant/sdk";

// 1. Initialize
const agent = new AgentClient({
  privateKey: process.env.AGENT_KEY,
  rpcUrl: "https://evm-t3.cronos.org", // Cronos Testnet
  chainId: 338,
  usdcAddress: "0xc01..." // Your payment token
});

async function main() {
  try {
    // 2. Fetch paid resources (just like axios/fetch)
    const response = await agent.fetch<{ answer: string }>("http://localhost:3000/premium", {
        method: "POST",
        body: { prompt: "Hello World" }
    });
    
    console.log("Success:", response.answer);

  } catch (err: any) {
    // 3. Handle Errors
    if (err instanceof AgentError) {
        console.error(`Status: ${err.status}`); // 402, 500
        console.error(`Code: ${err.code}`);     // POLICY_REJECTED, NETWORK_ERROR
    }
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
| `dailyLimit` | `number` | No | Max USDC allowed to spend per 24h. Default: 1.0 |
| `strictPolicy` | `boolean` | No | If `true`, Agent crashes if local config hash != on-chain hash. Default: `true`. |
| `anchors` | `object` | No | On-chain registry addresses. Auto-filled for Cronos Testnet. |
| `analyticsUrl` | `string` | No | URL for centralized logging of payment decisions (e.g. `https://api.myapp.com/analytics`). |
| `allowedMerchants` | `string[]` | No | List of Merchant IDs to trust. If empty, allows all. |
| `trustedFacilitators` | `string[]` | No | List of Gateway URLs to trust (e.g., localhost). |

## 🛡️ Security Workflow (Strict Mode)
	
When `strictPolicy` is `true` (default), you must register your configuration hash on-chain whenever you change limits.
	
1.  **Define Limits**: Set `dailyLimit` in your code.
2.  **Seal Policy**: Use the Admin helper to write the hash to the chain.
	
```typescript
import { AgentAdmin } from "@cronos-merchant/sdk";

await AgentAdmin.setPolicy({
  privateKey: process.env.AGENT_KEY
}, {
  dailyLimit: 0.5,
  maxPerTransaction: 0.5
});
```
	
3.  **Run Agent**: The Agent checks `Local Limit == On-Chain Limit` before spending.

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
