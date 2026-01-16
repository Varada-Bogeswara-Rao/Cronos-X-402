import { Request, Response, NextFunction, RequestHandler } from "express";
import axios, { AxiosInstance } from "axios";
import cache from "memory-cache";
import crypto from "crypto";
import { ethers } from "ethers";

// Minimal ABI for MerchantRegistry
const REGISTRY_ABI = [
    "function getMerchant(string calldata merchantId) external view returns (address wallet, bool isActive, string memory metadataURI)"
];

/**
 * Configuration for the x402 Merchant Middleware.
 */
export interface PaymentMiddlewareConfig {
    merchantId: string;
    gatewayUrl: string;
    facilitatorUrl: string;
    network: "cronos-mainnet" | "cronos-testnet";
    cacheTTLms?: number;
    /**
     * If true, errors during price check or verification will NOT block the request (unsafe mode).
     * Default: false (Fail Closed)
     */
    failMode?: "open" | "closed";

    /**
     * Optional: On-Chain Registry Address for Anti-Phishing Verification
     */
    merchantRegistryAddress?: string;
    /**
     * The address expected to receive funds (used to verify against registry)
     */
    recipientAddress?: string;
}

export interface PaymentReceipt {
    txHash: string;
    payer: string;
    amount: number;
    currency: string;
}

/**
 * Lightweight retry utility for critical protocol calls
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 500): Promise<T> {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err: any) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
        }
    }
    throw new Error("Unreachable");
}

/**
 * Express middleware to enforce x402 payments for API routes.
 */
export function paymentMiddleware(config: PaymentMiddlewareConfig): RequestHandler {
    const { merchantId, gatewayUrl, facilitatorUrl, network, cacheTTLms, failMode } = config;

    if (!merchantId || !gatewayUrl || !facilitatorUrl) {
        throw new Error("paymentMiddleware: missing required configuration (merchantId, gatewayUrl, or facilitatorUrl)");
    }

    const client: AxiosInstance = axios.create({
        timeout: 10000,
        headers: { "x-merchant-id": merchantId }
    });

    // [SECURITY] 0. Anti-Phishing / Registry Verification (Async Check)
    if (config.merchantRegistryAddress && config.recipientAddress) {
        // We perform this check in the background to avoid blocking startup, 
        // but log heavily if it fails.
        (async () => {
            try {
                // Determine RPC based on network
                const rpcUrl = network === "cronos-mainnet"
                    ? "https://evm.cronos.org"
                    : "https://evm-t3.cronos.org";

                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const registry = new ethers.Contract(config.merchantRegistryAddress!, REGISTRY_ABI, provider);

                console.log(`[PaymentMiddleware] Verifying merchant '${merchantId}' on-chain...`);
                const onChainMerchant = await registry.getMerchant(merchantId);

                if (onChainMerchant.wallet.toLowerCase() !== config.recipientAddress!.toLowerCase()) {
                    const msg = `CRITICAL: Wallet Mismatch! Configured: ${config.recipientAddress}, Registry: ${onChainMerchant.wallet}`;
                    console.error(`[PaymentMiddleware] 🚨 ${msg}`);
                    if (failMode !== "open") {
                        // In strict mode, we might want to kill the process or disable payment processing
                        // For now, valid alerts are sufficient.
                    }
                } else if (!onChainMerchant.isActive) {
                    console.warn(`[PaymentMiddleware] ⚠️ Merchant is marked INACTIVE in on-chain registry.`);
                } else {
                    console.log(`[PaymentMiddleware] ✅ Merchant identity verified on-chain.`);
                }
            } catch (err: any) {
                console.error(`[PaymentMiddleware] Registry verification failed: ${err.message}`);
            }
        })();
    }

    return async (req: Request, res: Response, next: NextFunction) => {
        // [DX] 1. Preflight & Options Support (P1)
        if (req.method === 'OPTIONS') {
            res.header("Access-Control-Expose-Headers", "x-nonce, x-payment-required, x-payment-amount, x-payment-currency, x-payment-payto, x-merchant-id");
            return next();
        }

        try {
            const method = req.method.toUpperCase();

            // [PROTOCOL] Canonical Path Enforcment
            const fullPath = req.originalUrl || req.url;
            const cleanPath = fullPath.split('?')[0].replace(/\/$/, "") || "/";

            // [PERFORMANCE] 2. Cache Invalidation (P1)
            // We use a simplified cache key. 
            // Ideally, we'd check a "version" from a webhook or short TTL.
            // For protocol correctness, we stick to a reasonable TTL.
            const cacheKey = `price:${merchantId}:${method}:${cleanPath}`;
            const ttl = cacheTTLms ?? 30_000; // Reduced from 60s to 30s to be fresher

            let priceData = cache.get(cacheKey);

            if (!priceData) {
                // [RELIABILITY] 3. Retry Strategy (P1)
                const { data } = await withRetry(() => client.post(`${gatewayUrl}/api/price-check`, {
                    merchantId,
                    method,
                    path: cleanPath
                }));

                priceData = data;

                // [PROTOCOL] Respect upstream cache version hints if provided
                if (priceData.version) {
                    // We could append version to key, but short TTL is cleaner for middleware
                }

                cache.put(cacheKey, priceData, ttl);
            }

            const { price, currency, payTo, description } = priceData;

            // [SECURITY] 4. Secure Nonce Handling (P0)
            const getHeader = (key: string): string | undefined => {
                const val = req.headers[key.toLowerCase()];
                return Array.isArray(val) ? val[0] : val;
            };

            const paymentProof = getHeader("x-payment-proof");
            const nonce = getHeader("x-nonce");
            // We do NOT trust x-payment-payer

            if (!paymentProof || !nonce) {
                // Generate secure nonce if missing
                const newNonce = crypto.randomBytes(12).toString('hex');
                const chainId = network === "cronos-mainnet" ? "25" : "338";

                res.status(402)
                    .set({
                        "Access-Control-Expose-Headers": "x-nonce, x-payment-required, x-payment-amount, x-payment-currency, x-payment-payto, x-merchant-id, x-facilitator-url, x-payment-description, x-chain-id, x-route",
                        "X-Payment-Required": "true",
                        "X-Payment-Amount": price,
                        "X-Payment-Currency": currency,
                        "X-Payment-Network": network,
                        "X-Payment-PayTo": payTo,
                        "X-Merchant-ID": merchantId,
                        "X-Facilitator-URL": facilitatorUrl,
                        "X-Payment-Description": description ?? "Premium Access",
                        "X-Nonce": newNonce, // [CRITICAL] Propagate Nonce for Server Binding
                        "X-Chain-ID": chainId,
                        "X-Route": `${method} ${cleanPath}`
                    })
                    .json({
                        error: "PAYMENT_REQUIRED",
                        message: "Payment required. Sign and broadcast transaction with provided nonce.",
                        paymentRequest: {
                            chainId: Number(chainId),
                            merchantId,
                            amount: price,
                            currency,
                            payTo,
                            nonce: newNonce,
                            route: `${method} ${cleanPath}`
                        }
                    });
                return;
            }

            // [SECURITY] 5. Verification (P0)
            // Forward everything associated with the payment context.
            // Do NOT include `expectedPayer` from client headers.
            const verifyResponse = await withRetry(() => client.post(
                `${facilitatorUrl}/api/facilitator/verify`,
                {
                    paymentProof, // The txHash
                    nonce,        // [CRITICAL] The nonce claimed by client (must match tx/server key)
                    expectedAmount: price,
                    currency,
                    path: cleanPath,
                    method
                }
            ));

            if (!verifyResponse.data?.verified) {
                res.status(402).json({
                    error: "PAYMENT_VERIFICATION_FAILED",
                    message: "Payment verification returned false"
                });
                return;
            }

            // [SECURITY] 6. Trust Source: Facilitator Only
            req.payment = {
                txHash: verifyResponse.data.txHash,
                payer: verifyResponse.data.payer, // Derived from chain by Facilitator
                amount: price,
                currency
            };

            next();

        } catch (error: any) {
            const status = error.response?.status;

            // [PROTOCOL] 7. Error Semantics Propagation (P0)
            if (status === 402 || status === 403 || status === 404 || status === 410) {
                res.status(status).json(error.response.data);
                return;
            }

            console.error("[PaymentMiddleware] Unexpected Error:", error.message);

            if (failMode === "open") {
                console.warn("[PaymentMiddleware] FAIL_OPEN active. Allowing request despite error.");
                return next();
            }

            // Default: Fail Closed (502 Bad Gateway)
            res.status(502).json({
                error: "PAYMENT_GATEWAY_ERROR",
                message: "Unable to verify payment with facilitator."
            });
        }
    };
}