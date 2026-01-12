import axios from "axios";
import { AgentWallet } from "./AgentWallet";
import { WalletContext, PaymentRequest as AgentPaymentRequest } from "./types";
import { AgentError } from "../errors";

const HTTP_TIMEOUT_MS = 180_000;

// Helper for fire-and-forget logging
async function logDecision(
  context: WalletContext,
  agentAddress: string,
  req: AgentPaymentRequest,
  decision: "APPROVED" | "BLOCKED",
  reason?: string,
  txHash?: string
) {
  if (!context.analyticsUrl) return;

  // Non-blocking catch
  axios.post(`${context.analyticsUrl}/api/analytics/log`, {
    agentAddress,
    url: req.facilitatorUrl,
    merchantId: req.merchantId,
    amount: req.amount,
    currency: req.currency,
    decision,
    reason,
    txHash,
    chainId: context.chainId
  }).catch(err => {
    // Silent fail for analytics to not break flow
  });
}

export async function x402Request(
  url: string,
  wallet: AgentWallet,
  context: WalletContext,
  options: {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
  } = {}
) {
  let paymentAttempted = false; // 🛡️ CRITICAL: Prevents the "Drain Loop"

  // 0. Version Check
  console.log("[SDK] v1.0.4 - ROBUST MODE");

  // Normalize inputs to support both nested headers and flat structure
  const { method, body, headers, ...rest } = options as any;
  // MERGE both sources: flat properties (rest) and nested headers
  const effectiveHeaders = { ...rest, ...(headers || {}) };

  try {
    // 1. Initial attempt to fetch data
    const res = await axios({
      url,
      method: method ?? "GET",
      data: body,
      headers: {
        ...effectiveHeaders,
        "x-merchant-id": context.merchantId || "",
        "x-chain-id": context.chainId.toString(),
      },
      timeout: options.timeoutMs ?? HTTP_TIMEOUT_MS,
      validateStatus: (status) => status === 200 || status === 402,
    });

    if (res.status === 200) {
      return { data: res.data, payment: null };
    }

    // 2. 402 Flow
    console.log("[x402] Payment Required Challenge received");
    console.log("[SDK] Response Headers:", JSON.stringify(res.headers, null, 2));
    console.log("[SDK] Response Body:", JSON.stringify(res.data, null, 2));

    if (paymentAttempted) {
      // If the server asks for pay again immediately after we just paid, something is wrong.
      throw new Error("Recursive 402 detected: Server refused proof or loop occurred.");
    }

    let paymentRequest;
    try {
      paymentRequest = wallet.parse402Header(res.headers);
    } catch (headerErr) {
      console.warn("[SDK] parsing headers failed, trying body...", headerErr);
      try {
        paymentRequest = wallet.parse402Body(res.data, context.merchantId || "unknown", url);
      } catch (bodyErr) {
        throw new Error(`Failed to parse 402 challenge from Headers OR Body. Header error: ${headerErr}. Body error: ${bodyErr}`);
      }
    }

    const decision = wallet.shouldPay(paymentRequest, context);
    const agentAddress = wallet.getAddress();

    if (!decision.allow) {
      logDecision(context, agentAddress, paymentRequest, "BLOCKED", decision.reason);
      throw new Error(`Agent Policy Rejection: ${decision.reason}`);
    }

    // Mark as attempted BEFORE the async call to be safe
    paymentAttempted = true;

    // Execute on-chain payment
    const paymentProof = await wallet.executePayment(paymentRequest);
    // agentAddress is already defined above

    // Log APPROVED
    logDecision(context, agentAddress, paymentRequest, "APPROVED", undefined, paymentProof);

    console.log("[x402] Payment successful. Retrying with proof...");

    // 3. Retry with Proof and Contextual Headers
    const retryHeaders = {
      ...effectiveHeaders,
      "x-merchant-id": context.merchantId || "",
      "x-payment-proof": paymentProof,
      "x-payment-payer": agentAddress,
      "x-payment-nonce": paymentRequest.nonce,
      "x-payment-route": paymentRequest.route,
    };
    console.log("[SDK] Retry Headers:", JSON.stringify(retryHeaders, null, 2));

    const retry = await axios({
      url,
      method: method ?? "GET",
      data: body,
      headers: retryHeaders,
      timeout: HTTP_TIMEOUT_MS,
    });

    return {
      data: retry.data,
      payment: {
        txHash: paymentProof,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        chain: paymentRequest.chainId
      }
    };

  } catch (err: any) {
    if (err instanceof Error && err.name === "AgentError") {
      throw err; // Already wrapped
    }

    const status = err.response?.status;
    const errorData = err.response?.data || err.message;

    // Log minimal info, let the caller handle the details
    console.warn(`[x402] Request Failed: ${status || "Network"} - ${err.message}`);

    throw new AgentError(
      `Request failed with status code ${status || "unknown"}: ${JSON.stringify(errorData)}`,
      status ? "HTTP_ERROR" : "NETWORK_ERROR",
      status,
      errorData
    );
  }
}
