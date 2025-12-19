import { Request, Response, NextFunction } from "express";
import axios from "axios";

export interface PaymentMiddlewareConfig {
    merchantId: string;
    gatewayUrl: string;
    facilitatorUrl: string;
    network: "cronos-mainnet" | "cronos-testnet";
}

export function paymentMiddleware(config: PaymentMiddlewareConfig) {
    const {
        merchantId,
        gatewayUrl,
        facilitatorUrl,
        network
    } = config;

    if (!merchantId || !gatewayUrl || !facilitatorUrl) {
        throw new Error("paymentMiddleware: invalid configuration");
    }

    return async function (
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const method = req.method.toUpperCase();
            const path = req.route?.path || req.path;

            // ----------------------------
            // 1. Ask gateway for price
            // ----------------------------
            const priceResponse = await axios.post(
                `${gatewayUrl}/api/price-check`,
                {
                    merchantId,
                    method,
                    path
                },
                { timeout: 3000 }
            );

            const {
                price,
                currency,
                payTo,
                description
            } = priceResponse.data;

            // ----------------------------
            // 2. Check for payment proof
            // ----------------------------
            const paymentProof = req.headers["x-payment-proof"];

            if (!paymentProof) {
                // ❌ No payment — request payment
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
            // 3. Verify payment with facilitator
            // ----------------------------
            const verifyResponse = await axios.post(
                `${facilitatorUrl}/api/facilitator/verify`,
                {
                    merchantId,
                    paymentProof,
                    expectedAmount: price,
                    currency
                },
                { timeout: 3000 }
            );

            if (!verifyResponse.data?.verified) {
                return res.status(402).json({
                    error: "PAYMENT_VERIFICATION_FAILED",
                    message: "Invalid or insufficient payment"
                });
            }

            // ----------------------------
            // 4. Attach receipt to request
            // ----------------------------
            (req as any).payment = {
                txHash: verifyResponse.data.txHash,
                payer: verifyResponse.data.payer,
                amount: price,
                currency
            };

            // ----------------------------
            // 5. Continue to API logic
            // ----------------------------
            return next();

        } catch (error: any) {
            console.error("[PAYMENT_MIDDLEWARE_ERROR]", error?.response?.data || error);

            return res.status(500).json({
                error: "PAYMENT_GATEWAY_ERROR",
                message: error?.response?.data || error.message || "Unknown error"
            });
        }

    };
}
