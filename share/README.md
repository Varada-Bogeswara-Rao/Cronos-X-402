# Cronos Merchant SDK

A robust, multi-chain agent client that enables your AI Agents to pay for APIs autonomously. 

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
| `allowedMerchants` | `string[]` | No | List of Merchant IDs to trust. If empty, allows all. |
| `trustedFacilitators` | `string[]` | No | List of Gateway URLs to trust (e.g., localhost). |

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

### `AgentError`

Thrown when a request fails or is blocked by policy.

*   `err.status`: The HTTP status code (e.g., 400, 402, 500).
*   `err.code`: A machine-readable string:
    *   `POLICY_REJECTED`: Blocked by daily limit or whitelist.
    *   `INSUFFICIENT_FUNDS`: Not enough USDC/Gas.
    *   `HTTP_ERROR`: Server returned an error (details in `err.details`).
*   `err.details`: The raw response body from the server.

## License

MIT
