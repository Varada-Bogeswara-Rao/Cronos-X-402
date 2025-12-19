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
                const path = ((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || req.path;
                // ----------------------------
                // 1. Ask gateway for price
                // ----------------------------
                const priceResponse = yield axios_1.default.post(`${gatewayUrl}/api/price-check`, {
                    merchantId,
                    method,
                    path
                }, { timeout: 3000 });
                const { price, currency, payTo, description } = priceResponse.data;
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
                const verifyResponse = yield axios_1.default.post(`${facilitatorUrl}/api/facilitator/verify`, {
                    merchantId,
                    paymentProof,
                    expectedAmount: price,
                    currency
                }, { timeout: 3000 });
                if (!((_b = verifyResponse.data) === null || _b === void 0 ? void 0 : _b.verified)) {
                    return res.status(402).json({
                        error: "PAYMENT_VERIFICATION_FAILED",
                        message: "Invalid or insufficient payment"
                    });
                }
                // ----------------------------
                // 4. Attach receipt to request
                // ----------------------------
                req.payment = {
                    txHash: verifyResponse.data.txHash,
                    payer: verifyResponse.data.payer,
                    amount: price,
                    currency
                };
                // ----------------------------
                // 5. Continue to API logic
                // ----------------------------
                return next();
            }
            catch (error) {
                console.error("[PAYMENT_MIDDLEWARE_ERROR]", (error === null || error === void 0 ? void 0 : error.message) || error);
                return res.status(500).json({
                    error: "PAYMENT_GATEWAY_ERROR",
                    message: "Unable to process payment request"
                });
            }
        });
    };
}
