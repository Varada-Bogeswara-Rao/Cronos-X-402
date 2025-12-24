import { Request, Response, NextFunction } from "express";
import axios from "axios";
import cache from "memory-cache";

export interface PaymentMiddlewareConfig {
    merchantId: string;
    gatewayUrl: string;
    facilitatorUrl: string;
    network: "cronos-mainnet" | "cronos-testnet";
}

export function paymentMiddleware(config: PaymentMiddlewareConfig) {
    const { merchantId, gatewayUrl, facilitatorUrl, network } = config;

    if (!merchantId || !gatewayUrl || !facilitatorUrl) {
        throw new Error("paymentMiddleware: invalid configuration");
    }

    return async function (req: Request, res: Response, next: NextFunction) {
        try {
            const method = req.method.toUpperCase();

            // ✅ Canonical path (single source of truth)
            const cleanPath = req.path.replace(/\/$/, "") || "/";

            const cacheKey = `price:${merchantId}:${method}:${cleanPath}`;

            // ----------------------------
            // 1. Price Check with Caching
            // ----------------------------
            let priceData = cache.get(cacheKey);

            if (!priceData) {
                const priceResponse = await axios.post(
                    `${gatewayUrl}/api/price-check`,
                    {
                        merchantId,
                        method,
                        path: cleanPath
                    },
                    { timeout: 15000 }
                );

                priceData = priceResponse.data;
                // Cache for 1 min to prevent hammering gateway
                cache.put(cacheKey, priceData, 60 * 1000);
            }

            const { price, currency, payTo, description } = priceData;

            // ----------------------------
            // 2. Proof Check
            // ----------------------------
            const paymentProof = req.headers["x-payment-proof"] as string;
            const payer = req.headers["x-payment-payer"] as string;
            const route = req.headers["x-payment-route"] as string;

            if (paymentProof) {
                console.log("[MIDDLEWARE] Payment headers received:", {
                    proof: paymentProof.substring(0, 10) + "...",
                    payer,
                    route
                });
            }

            if (!paymentProof) {
                // Generate Replay Protection Nonce
                const nonce = Math.random().toString(36).substring(7);
                const chainId = network === "cronos-mainnet" ? "25" : "338"; // 338 is Testnet

                return res.status(402)
                    .set({
                        "X-Payment-Required": "true",
                        "X-Payment-Amount": price,
                        "X-Payment-Currency": currency,
                        "X-Payment-Network": network,
                        "X-Payment-PayTo": payTo,
                        "X-Merchant-ID": merchantId,
                        "X-Facilitator-URL": facilitatorUrl,
                        "X-Payment-Description": description,
                        // [NEW] Replay Protection
                        "X-Nonce": nonce,
                        "X-Chain-ID": chainId,
                        "X-Route": `${method} ${cleanPath}`
                    })
                    .json({
                        error: "PAYMENT_REQUIRED",
                        message: "Payment required to access this resource",
                        // ✅ SDK COMPATIBILITY: Include structured payment request in body
                        paymentRequest: {
                            chainId: Number(chainId),
                            merchantId,
                            amount: price,
                            currency,
                            receiver: payTo,
                            nonce,
                            route: `${method} ${cleanPath}`
                        }
                    });
            }

            // ----------------------------
            // 3. Robust Verification
            // ----------------------------
            const verifyResponse = await axios.post(
                `${facilitatorUrl}/api/facilitator/verify`,
                {
                    paymentProof,
                    expectedAmount: price,
                    currency,
                    path: cleanPath,
                    method
                },
                {
                    headers: {
                        "x-merchant-id": merchantId
                    },
                    timeout: 15000
                }
            );

            if (!verifyResponse.data?.verified) {
                return res.status(402).json({
                    error: "PAYMENT_VERIFICATION_FAILED",
                    message: "Invalid or insufficient payment"
                });
            }


            console.log("[MIDDLEWARE] Incoming request", { method, cleanPath });
            console.log("[MIDDLEWARE] Price resolved", { price, currency, payTo });
            console.log("[MIDDLEWARE] Verifying tx", { paymentProof });

            // ----------------------------
            // 4. Attach Receipt
            // ----------------------------
            (req as any).payment = {
                txHash: verifyResponse.data.txHash,
                payer: verifyResponse.data.payer,
                amount: price,
                currency
            };

            return next();

        } catch (error: any) {
            console.error("[PAYMENT_MIDDLEWARE_CRASH]", error.response?.data || error.message);
            return res.status(500).json({
                error: "PAYMENT_GATEWAY_ERROR",
                message: "An internal error occurred during payment processing."
            });
        }
    };
}