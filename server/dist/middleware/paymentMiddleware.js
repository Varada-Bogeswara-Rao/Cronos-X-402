"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentMiddleware = paymentMiddleware;
const axios_1 = __importDefault(require("axios"));
const memory_cache_1 = __importDefault(require("memory-cache"));
function paymentMiddleware(config) {
    const { merchantId, gatewayUrl, facilitatorUrl, network } = config;
    if (!merchantId || !gatewayUrl || !facilitatorUrl) {
        throw new Error("paymentMiddleware: invalid configuration");
    }
    return function (req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const method = req.method.toUpperCase();
                const path = req.path;
                const cleanPath = req.path; // no query string
                const cacheKey = `price:${merchantId}:${method}:${cleanPath}`;
                // ----------------------------
                // 1. Price Check with Caching
                // ----------------------------
                let priceData = memory_cache_1.default.get(cacheKey);
                if (!priceData) {
                    const priceResponse = yield axios_1.default.post(`${gatewayUrl}/api/price-check`, { merchantId, method, path }, { timeout: 5000 } // Increased slightly for production stability
                    );
                    priceData = priceResponse.data;
                    // Cache price for 5 minutes to reduce Gateway load
                    memory_cache_1.default.put(cacheKey, priceData, 5 * 60 * 1000);
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
                    const verifyResponse = yield axios_1.default.post(`${facilitatorUrl}/api/facilitator/verify`, {
                        merchantId,
                        paymentProof,
                        expectedAmount: price,
                        currency,
                        expectedPayer: paymentPayer,
                        path,
                        method
                    }, { timeout: 15000 } // Blockchain verification takes time
                    );
                    if (!((_a = verifyResponse.data) === null || _a === void 0 ? void 0 : _a.verified)) {
                        return res.status(402).json({
                            error: "PAYMENT_VERIFICATION_FAILED",
                            message: "Invalid or insufficient payment"
                        });
                    }
                    // ----------------------------
                    // 4. Attach Receipt
                    // ----------------------------
                    req.payment = {
                        txHash: verifyResponse.data.txHash,
                        payer: verifyResponse.data.payer || paymentPayer,
                        amount: price,
                        currency
                    };
                    return next();
                }
                catch (verifyError) {
                    // If the Facilitator is down/timed out, we must fail safely
                    console.error("[FACILITATOR_OFFLINE]", verifyError.message);
                    return res.status(503).json({
                        error: "VERIFICATION_SERVICE_UNAVAILABLE",
                        message: "Payment verification system is temporarily down."
                    });
                }
            }
            catch (error) {
                // Centralized error logging (use a logger like Pino or Winston here)
                console.error("[PAYMENT_MIDDLEWARE_CRASH]", {
                    path: req.path,
                    error: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message
                });
                return res.status(500).json({
                    error: "PAYMENT_GATEWAY_ERROR",
                    message: "An internal error occurred during payment processing."
                });
            }
        });
    };
}
