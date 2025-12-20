// x402ToolClient.ts
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
    const res = await axios.get(url, { headers });
    return res.data;
  } catch (err: any) {
    if (err.response?.status !== 402) {
      throw err;
    }

    console.log("[x402.0] Payment required");

    const paymentRequest = wallet.parse402Header(err.response.headers);

    const decision = wallet.shouldPay(paymentRequest, context);
    if (!decision.allow) {
      throw new Error(`Payment rejected: ${decision.reason}`);
    }

    const paymentProof = await wallet.executePayment(paymentRequest);
    const agentAddress = await wallet.getAddress();


    console.log("[x402] Retrying request with payment proof");

    const retry = await axios.get(url, {
      headers: {
        ...headers,
        "X-Payment-Proof": paymentProof,
        "X-Payment-Payer": agentAddress
      }
    });

    return retry.data;
  }
}
