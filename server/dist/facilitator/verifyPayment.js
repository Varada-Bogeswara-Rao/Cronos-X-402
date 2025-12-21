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
const ethers_1 = require("ethers");
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Merchant_1 = __importDefault(require("../models/Merchant"));
const router = (0, express_1.Router)();
const CONFIRMATIONS_REQUIRED = process.env.NODE_ENV === "production" ? 3 : 1;
const getProvider = () => {
    return new ethers_1.ethers.JsonRpcProvider(process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org", undefined, { staticNetwork: true });
};
// 🔒 Canonical path helper (SINGLE SOURCE OF TRUTH)
const canonicalPath = (path) => path.replace(/\/$/, "") || "/";
router.post("/verify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const merchantId = req.headers["x-merchant-id"];
        const { paymentProof, expectedAmount, currency, path, method } = req.body;
        if (!merchantId || !paymentProof || !expectedAmount || !currency || !path || !method) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "Missing required verification fields"
            });
        }
        const cleanPath = canonicalPath(path);
        const cleanMethod = method.toUpperCase();
        console.log("[FACILITATOR] verify request", {
            merchantId,
            cleanMethod,
            cleanPath,
            currency,
            expectedAmount
        });
        // --------------------------------------------------
        // 1. Replay Protection
        // --------------------------------------------------
        const existingTx = yield Transaction_1.default.findOne({ txHash: paymentProof }).lean();
        if (existingTx) {
            return res.status(402).json({
                verified: false,
                error: "REPLAY_DETECTED"
            });
        }
        // --------------------------------------------------
        // 2. Fetch Merchant
        // --------------------------------------------------
        const merchant = yield Merchant_1.default.findOne({ merchantId }).lean();
        if (!merchant || !((_a = merchant.status) === null || _a === void 0 ? void 0 : _a.active)) {
            return res.status(403).json({
                error: "MERCHANT_INACTIVE"
            });
        }
        // --------------------------------------------------
        // 3. 🔥 ROUTE REGISTRATION CHECK (MISSING EARLIER)
        // --------------------------------------------------
        const route = (_c = (_b = merchant.api) === null || _b === void 0 ? void 0 : _b.routes) === null || _c === void 0 ? void 0 : _c.find((r) => r.method === cleanMethod &&
            canonicalPath(r.path) === cleanPath);
        if (!route) {
            console.error("[FACILITATOR] ROUTE_NOT_REGISTERED", {
                cleanMethod,
                cleanPath,
                registeredRoutes: (_d = merchant.api) === null || _d === void 0 ? void 0 : _d.routes
            });
            return res.status(402).json({
                error: "ROUTE_NOT_REGISTERED",
                message: "This path is not monetized by the merchant."
            });
        }
        // --------------------------------------------------
        // 4. Chain Verification
        // --------------------------------------------------
        const provider = getProvider();
        const receipt = yield provider.getTransactionReceipt(paymentProof);
        if (!receipt || receipt.status !== 1) {
            return res.status(402).json({
                verified: false,
                error: "TX_NOT_FOUND_OR_FAILED"
            });
        }
        const tx = yield provider.getTransaction(paymentProof);
        if (!tx || !tx.from) {
            return res.status(402).json({
                verified: false,
                error: "TX_INVALID"
            });
        }
        const payer = tx.from.toLowerCase();
        const merchantAddress = merchant.wallet.address.toLowerCase();
        const network = yield provider.getNetwork();
        const expectedChainId = BigInt(process.env.CRONOS_CHAIN_ID || 338);
        if (network.chainId !== expectedChainId) {
            return res.status(402).json({ error: "WRONG_NETWORK" });
        }
        // --------------------------------------------------
        // 5. Payment Verification
        // --------------------------------------------------
        let verified = false;
        if (currency === "USDC") {
            const usdcAddress = (process.env.USDC_CONTRACT_ADDRESS ||
                "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0").toLowerCase();
            const expectedRawAmount = ethers_1.ethers.parseUnits(expectedAmount.toString(), 6);
            const iface = new ethers_1.ethers.Interface([
                "event Transfer(address indexed from, address indexed to, uint256 value)"
            ]);
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== usdcAddress)
                    continue;
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed &&
                        parsed.args.from.toLowerCase() === payer &&
                        parsed.args.to.toLowerCase() === merchantAddress &&
                        parsed.args.value >= expectedRawAmount) {
                        verified = true;
                        break;
                    }
                }
                catch (_f) { }
            }
        }
        if (currency === "CRO" || currency === "TCRO") {
            if (((_e = tx.to) === null || _e === void 0 ? void 0 : _e.toLowerCase()) === merchantAddress &&
                tx.value >= ethers_1.ethers.parseEther(expectedAmount.toString())) {
                verified = true;
            }
        }
        // --------------------------------------------------
        // 6. Confirmation Check
        // --------------------------------------------------
        const confirmations = (yield provider.getBlockNumber()) - receipt.blockNumber;
        if (confirmations < CONFIRMATIONS_REQUIRED) {
            return res.status(402).json({
                verified: false,
                error: "AWAITING_CONFIRMATIONS",
                confirmations,
                required: CONFIRMATIONS_REQUIRED
            });
        }
        if (!verified) {
            return res.status(402).json({
                verified: false,
                error: "VERIFICATION_FAILED"
            });
        }
        // --------------------------------------------------
        // 7. Persist Transaction
        // --------------------------------------------------
        yield Transaction_1.default.create({
            txHash: paymentProof,
            merchantId,
            payer,
            amount: expectedAmount,
            currency,
            path: cleanPath,
            method: cleanMethod
        });
        return res.status(200).json({
            verified: true,
            txHash: paymentProof,
            payer,
            confirmations
        });
    }
    catch (error) {
        console.error("[FACILITATOR_CRITICAL_ERROR]", error);
        return res.status(500).json({
            error: "FACILITATOR_FAULT",
            message: "Blockchain verification failed"
        });
    }
}));
exports.default = router;
