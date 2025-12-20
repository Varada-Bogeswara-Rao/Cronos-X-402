import axios from "axios";
import { AgentWallet } from "./AgentWallet";
import { WalletContext } from "./types";

export async function x402Request(
  url: string,
  wallet: AgentWallet,
  context: WalletContext,
  headers: Record<string, string> = {}
) {
  try {
    // 1. Initial Attempt
    const res = await axios.get(url, {
      headers: {
        ...headers,
        "x-merchant-id": context.merchantId || "",
      },
      // Allow 402 to pass through to the 'if' block below
      validateStatus: (status) => status === 200 || status === 402,
    });

    // ✅ FIXED: Changed 'response' to 'res'
    if (res.status === 200) {
      return res.data;
    }

    // 2. Handle 402 Payment Required
    console.log("[x402.0] Payment required detected via 402 status");

    // Use the headers from the 402 response to get payment details
    const paymentRequest = wallet.parse402Header(res.headers);

    const decision = wallet.shouldPay(paymentRequest, context);
    if (!decision.allow) {
      throw new Error(`Payment rejected: ${decision.reason}`);
    }

    // Execute the blockchain transaction
    const paymentProof = await wallet.executePayment(paymentRequest);
    const agentAddress = await wallet.getAddress();

    console.log("[x402] Retrying request with payment proof...");

    // 3. Final Request with Proof
    const retry = await axios.get(url, {
      headers: {
        ...headers,
        "x-merchant-id": context.merchantId || "", // ⚡️ Critical for Multi-tenancy
        "X-Payment-Proof": paymentProof,
        "X-Payment-Payer": agentAddress,
      },
    });

    return retry.data;

  } catch (err: any) {
    // This catches networking errors or non-402 API errors
    console.error("[x402.Error]", err.response?.data || err.message);
    throw err;
  }
}