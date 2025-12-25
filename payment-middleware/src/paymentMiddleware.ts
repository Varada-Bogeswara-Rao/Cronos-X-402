import { Request, Response, NextFunction, RequestHandler } from "express";
import axios, { AxiosInstance } from "axios";
import cache from "memory-cache";

/**
 * Configuration for the x402 Merchant Middleware.
 */
export interface PaymentMiddlewareConfig {
    merchantId: string;
    gatewayUrl: string;
    facilitatorUrl: string;
    network: "cronos-mainnet" | "cronos-testnet";
    cacheTTLms?: number;
}

export interface PaymentReceipt {
    txHash: string;
    payer: string;
    amount: number;
    currency: string;
}

/**
 * Express middleware to enforce x402 payments for API routes.
 * @param config Payment gateway and merchant configuration.
 */
export function paymentMiddleware(config: PaymentMiddlewareConfig): RequestHandler {
    const { merchantId, gatewayUrl, facilitatorUrl, network, cacheTTLms } = config;

    if (!merchantId || !gatewayUrl || !facilitatorUrl) {
        throw new Error("paymentMiddleware: missing required configuration (merchantId, gatewayUrl, or facilitatorUrl)");
    }

    const client: AxiosInstance = axios.create({
        timeout: 15000,
        headers: { "x-merchant-id": merchantId }
    });

    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const method = req.method.toUpperCase();
            const cleanPath = req.path.replace(/\/$/, "") || "/";
            const cacheKey = `price:${merchantId}:${method}:${cleanPath}`;
            const ttl = cacheTTLms ?? 60_000;

            let priceData = cache.get(cacheKey);

            if (!priceData) {
                const { data } = await client.post(`${gatewayUrl}/api/price-check`, {
                    merchantId,
                    method,
                    path: cleanPath
                });

                priceData = data;
                cache.put(cacheKey, priceData, ttl);
            }

            const { price, currency, payTo, description } = priceData;

            const getHeader = (headers: Request["headers"], key: string): string | undefined => {
                const value = headers[key.toLowerCase()];
                return Array.isArray(value) ? value[0] : value;
            };

            const paymentProof = getHeader(req.headers, "x-payment-proof");
            const payer = getHeader(req.headers, "x-payment-payer");

            if (!paymentProof) {
                const nonce = Math.random().toString(36).substring(7);
                const chainId = network === "cronos-mainnet" ? "25" : "338";

                res.status(402)
                    .set({
                        "X-Payment-Required": "true",
                        "X-Payment-Amount": price,
                        "X-Payment-Currency": currency,
                        "X-Payment-Network": network,
                        "X-Payment-PayTo": payTo,
                        "X-Merchant-ID": merchantId,
                        "X-Facilitator-URL": facilitatorUrl,
                        "X-Payment-Description": description,
                        "X-Nonce": nonce,
                        "X-Chain-ID": chainId,
                        "X-Route": `${method} ${cleanPath}`
                    })
                    .json({
                        error: "PAYMENT_REQUIRED",
                        message: "Payment required to access this resource",
                        paymentRequest: {
                            chainId: Number(chainId),
                            merchantId,
                            amount: price,
                            currency,
                            payTo,
                            nonce,
                            route: `${method} ${cleanPath}`
                        }
                    });
                return;
            }

            const verifyResponse = await client.post(
                `${facilitatorUrl}/api/facilitator/verify`,
                {
                    paymentProof,
                    expectedAmount: price,
                    currency,
                    expectedPayer: payer,
                    path: cleanPath,
                    method
                }
            );

            if (!verifyResponse.data?.verified) {
                res.status(402).json({
                    error: "PAYMENT_VERIFICATION_FAILED",
                    message: "Invalid or insufficient payment"
                });
                return;
            }

            req.payment = {
                txHash: verifyResponse.data.txHash,
                payer: verifyResponse.data.payer,
                amount: price,
                currency
            };

            next();
        } catch (error: any) {
            // Forward errors to the application's global error handler
            next(error);
        }
    };
}