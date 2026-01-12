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
    allowBodyFallback?: boolean;
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
      // [SECURITY] Explicit Opt-In for Body Fallback
      if (!options.allowBodyFallback) {
        throw new Error("402 Header Parsing Failed and allowBodyFallback is disabled. Server must provide X-Payment headers.");
      }

      console.warn("[SDK] parsing headers failed, trying body...", headerErr);
      try {
        paymentRequest = wallet.parse402Body(res.data, context.merchantId || "unknown", url);
      } catch (bodyErr) {
        throw new Error(`Failed to parse 402 challenge from Headers OR Body. Header error: ${headerErr}. Body error: ${bodyErr}`);
      }
    }

    const decision = wallet.shouldPay(paymentRequest, context, {
      route: wallet.parse402Header(res.headers).route // Validate against what the server claimed in headers
    });
    const agentAddress = wallet.getAddress();

    if (!decision.allow) {
      logDecision(context, agentAddress, paymentRequest, "BLOCKED", decision.reason);
      throw new Error(`Agent Policy Rejection: ${decision.reason}`);
    }

    // Mark as attempted BEFORE the async call
    paymentAttempted = true;

    // 3. Execute Payment (Authorized)
    console.log(`[x402] Payment Approved. Executing on Chain ${context.chainId}...`);
    let txHash: string;

    try {
      txHash = await wallet.executePayment(paymentRequest);
    } catch (execErr: any) {
      logDecision(context, agentAddress, paymentRequest, "BLOCKED", `Execution Failed: ${execErr.message}`);
      throw execErr;
    }

    logDecision(context, agentAddress, paymentRequest, "APPROVED", "Paid", txHash);

    // 4. Retry Request with Payment Proof
    console.log(`[x402] Payment Successful (${txHash}). Retrying request...`);

    // [SECURITY] Protocol Alignment
    // Must send: x-payment-proof (txHash) AND x-nonce (to verify binding)
    const retryHeaders = {
      ...effectiveHeaders,
      "X-Merchant-ID": context.merchantId || "",
      "X-Chain-ID": context.chainId.toString(),
      "X-Payment-Proof": txHash, // Canonical
      "X-Nonce": paymentRequest.nonce // Canonical
    };

    const retryRes = await axios({
      url,
      method: method ?? "GET",
      data: {
        ...(body || {}), // Preserve original body
        nonce: paymentRequest.nonce // [CRITICAL] Send nonce in body for ReplayKey
      },
      headers: retryHeaders,
      timeout: options.timeoutMs ?? HTTP_TIMEOUT_MS,
    });

    return {
      data: retryRes.data,
      payment: {
        txHash,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        chainId: paymentRequest.chainId // Normalized property name
      }
    };

  } catch (error: any) {
    // Enhanced error logging
    if (error.response?.status === 402) {
      // This happens if the proof was rejected (REPLAY_DETECTED, etc)
      console.error("[SDK] Payment Proof Rejected by Server:", error.response.data);
      throw new Error(`Use Access Denied: ${error.response.data.error || "UNKNOWN"} - ${error.response.data.message || "Proof rejected"}`);
    }
    // Continue to standard error handling
    if (error.name === "AgentError") throw error; // Already wrapped

    const status = error.response?.status;
    const errorData = error.response?.data || error.message;

    // Log minimal info, let the caller handle the details
    console.warn(`[x402] Request Failed: ${status || "Network"} - ${error.message}`);

    throw new AgentError(
      `Request failed with status code ${status || "unknown"}: ${JSON.stringify(errorData)}`,
      status ? "HTTP_ERROR" : "NETWORK_ERROR",
      status,
      errorData
    );
  }
}
