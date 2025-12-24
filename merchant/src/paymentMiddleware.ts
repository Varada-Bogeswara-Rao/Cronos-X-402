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
                        path: cleanPath   // ✅ FIX HERE
                    },
                    { timeout: 15000 }
                );

                priceData = priceResponse.data;

            }

            const { price, currency, payTo, description } = priceData;

            // ----------------------------
            // 2. Proof Check
            // ----------------------------
            // ----------------------------
            // 2. Proof Check
            // ----------------------------
            // ----------------------------
            // 2. Proof Check
            // ----------------------------
            const paymentProof = req.headers["x-payment-proof"] as string;
            const payer = req.headers["x-payment-payer"] as string;
            const nonce = req.headers["x-payment-nonce"] as string;
            const route = req.headers["x-payment-route"] as string;

            if (paymentProof) {
                console.log("[MIDDLEWARE] Payment headers received:", {
                    proof: paymentProof.substring(0, 10) + "...",
                    payer,
                    nonce,
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
                        // [NEW] Replay Protection & Strong Typing
                        "X-Nonce": nonce,
                        "X-Chain-ID": chainId,
                        "X-Route": `${method} ${cleanPath}`
                    })
                    .json({
                        error: "PAYMENT_REQUIRED",
                        message: "Payment required to access this resource"
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
                    path: cleanPath,   // ✅ FIX HERE
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


            console.log("[MIDDLEWARE] Incoming request", {
                method,
                cleanPath
            });

            console.log("[MIDDLEWARE] Price resolved", {
                price,
                currency,
                payTo
            });

            console.log("[MIDDLEWARE] Verifying tx", {
                paymentProof
            });

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

            // ✅ Forward explicit backend errors ("ROUTE_DISABLED", etc.)
            if (error.response?.data?.error) {
                return res.status(error.response.status).json(error.response.data);
            }

            return res.status(500).json({
                error: "PAYMENT_GATEWAY_ERROR",
                message: "An internal error occurred during payment processing."
            });
        }
    };

}