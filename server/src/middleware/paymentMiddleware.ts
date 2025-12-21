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
            const path = req.path;

            const cleanPath = req.path; // no query string
            const cacheKey = `price:${merchantId}:${method}:${cleanPath}`;

            // ----------------------------
            // 1. Price Check with Caching
            // ----------------------------
            let priceData = cache.get(cacheKey);

            if (!priceData) {
                const priceResponse = await axios.post(
                    `${gatewayUrl}/api/price-check`,
                    { merchantId, method, path },
                    { timeout: 5000 } // Increased slightly for production stability
                );
                priceData = priceResponse.data;
                // Cache price for 5 minutes to reduce Gateway load
                cache.put(cacheKey, priceData, 5 * 60 * 1000);
            }

            const { price, currency, payTo, description } = priceData;

            // ----------------------------
            // 2. Proof Check
            // ----------------------------
            const paymentProof = req.headers["x-payment-proof"];
            const paymentPayer = req.headers["x-payment-payer"];

            if (!paymentProof) {
                return res.status(402)
                    .set({
                        "X-Payment-Required": "true",
                        "X-Payment-Amount": price,
                        "X-Payment-Currency": currency,
                        "X-Payment-Network": network,
                        "X-Payment-PayTo": payTo,
                        "X-Merchant-ID": merchantId,
                        "X-Facilitator-URL": facilitatorUrl,
                        "X-Payment-Description": description
                    })
                    .json({
                        error: "PAYMENT_REQUIRED",
                        message: "Payment required to access this resource"
                    });
            }

            // ----------------------------
            // 3. Robust Verification
            // ----------------------------
            try {
                const verifyResponse = await axios.post(
                    `${facilitatorUrl}/api/facilitator/verify`,
                    {
                        merchantId,
                        paymentProof,
                        expectedAmount: price,
                        currency,
                        expectedPayer: paymentPayer,
                        path,
                        method
                    },
                    { timeout: 15000 } // Blockchain verification takes time
                );

                if (!verifyResponse.data?.verified) {
                    return res.status(402).json({
                        error: "PAYMENT_VERIFICATION_FAILED",
                        message: "Invalid or insufficient payment"
                    });
                }

                // ----------------------------
                // 4. Attach Receipt
                // ----------------------------
                (req as any).payment = {
                    txHash: verifyResponse.data.txHash,
                    payer: verifyResponse.data.payer || paymentPayer,
                    amount: price,
                    currency
                };

                return next();

            } catch (verifyError: any) {
                // If the Facilitator is down/timed out, we must fail safely
                console.error("[FACILITATOR_OFFLINE]", verifyError.message);
                return res.status(503).json({
                    error: "VERIFICATION_SERVICE_UNAVAILABLE",
                    message: "Payment verification system is temporarily down."
                });
            }

        } catch (error: any) {
            // Centralized error logging (use a logger like Pino or Winston here)
            console.error("[PAYMENT_MIDDLEWARE_CRASH]", {
                path: req.path,
                error: error.response?.data || error.message
            });

            return res.status(500).json({
                error: "PAYMENT_GATEWAY_ERROR",
                message: "An internal error occurred during payment processing."
            });
        }
    };
}