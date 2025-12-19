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
const express_1 = require("express");
const Merchant_1 = __importDefault(require("../models/Merchant"));
const router = (0, express_1.Router)();
/**
 * POST /api/facilitator/verify
 * Verifies an x402 payment proof
 */
router.post("/facilitator/verify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { merchantId, paymentProof, expectedAmount, currency } = req.body;
        // ----------------------------
        // 1. Validate request
        // ----------------------------
        if (!merchantId || !paymentProof || !expectedAmount || !currency) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "Missing required verification fields"
            });
        }
        // ----------------------------
        // 2. Fetch merchant (sanity check)
        // ----------------------------
        const merchant = yield Merchant_1.default.findOne({ merchantId }).lean();
        if (!merchant) {
            return res.status(404).json({
                error: "MERCHANT_NOT_FOUND",
                message: "Merchant does not exist"
            });
        }
        if (!((_a = merchant.status) === null || _a === void 0 ? void 0 : _a.active) || ((_b = merchant.status) === null || _b === void 0 ? void 0 : _b.suspended)) {
            return res.status(403).json({
                error: "MERCHANT_INACTIVE",
                message: "Merchant is inactive or suspended"
            });
        }
        // ----------------------------
        // 3. MOCK payment verification
        // ----------------------------
        // ⚠️ Hackathon mode:
        // In production, replace this with:
        // - Cronos RPC call
        // - ERC20 Transfer log parsing
        // - Recipient + amount verification
        const mockChainVerification = {
            txHash: paymentProof,
            payer: "0xMOCK_USER_ADDRESS",
            amount: expectedAmount,
            currency,
            network: merchant.wallet.network,
            recipient: merchant.wallet.address
        };
        // ----------------------------
        // 4. Final consistency checks
        // ----------------------------
        if (mockChainVerification.amount !== expectedAmount) {
            return res.status(402).json({
                verified: false,
                error: "AMOUNT_MISMATCH",
                message: "Payment amount mismatch"
            });
        }
        if (mockChainVerification.currency !== currency) {
            return res.status(402).json({
                verified: false,
                error: "CURRENCY_MISMATCH",
                message: "Currency mismatch"
            });
        }
        // ----------------------------
        // 5. Success response (receipt)
        // ----------------------------
        return res.status(200).json({
            verified: true,
            txHash: mockChainVerification.txHash,
            payer: mockChainVerification.payer,
            amount: mockChainVerification.amount,
            currency: mockChainVerification.currency,
            network: mockChainVerification.network
        });
    }
    catch (error) {
        console.error("[FACILITATOR_VERIFY_ERROR]", error);
        return res.status(500).json({
            error: "FACILITATOR_ERROR",
            message: "Unable to verify payment"
        });
    }
}));
exports.default = router;
