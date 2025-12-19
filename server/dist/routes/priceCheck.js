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
 * POST /api/price-check
 * Authoritative price lookup for x402 middleware
 */
// Route is mounted at /api/price-check in server.ts, so this becomes /api/price-check/
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { merchantId, method, path } = req.body;
        // ----------------------------
        // 1. Basic validation
        // ----------------------------
        if (!merchantId || !method || !path) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "merchantId, method, and path are required"
            });
        }
        // ----------------------------
        // 2. Fetch merchant
        // ----------------------------
        const merchant = yield Merchant_1.default.findOne({ merchantId }).lean();
        if (!merchant) {
            return res.status(404).json({
                error: "MERCHANT_NOT_FOUND",
                message: "Merchant does not exist"
            });
        }
        // ----------------------------
        // 3. Merchant status checks
        // ----------------------------
        if (!((_a = merchant.status) === null || _a === void 0 ? void 0 : _a.active) || ((_b = merchant.status) === null || _b === void 0 ? void 0 : _b.suspended)) {
            return res.status(403).json({
                error: "MERCHANT_INACTIVE",
                message: "Merchant is inactive or suspended"
            });
        }
        // ----------------------------
        // 4. Route lookup
        // ----------------------------
        const route = merchant.api.routes.find((r) => r.method.toUpperCase() === method.toUpperCase() &&
            r.path === path);
        if (!route) {
            return res.status(404).json({
                error: "ROUTE_NOT_REGISTERED",
                message: "Requested route is not monetized"
            });
        }
        // ----------------------------
        // 5. Build authoritative response
        // ----------------------------
        return res.status(200).json({
            merchantId: merchant.merchantId,
            price: route.price,
            currency: route.currency,
            payTo: merchant.wallet.address,
            network: merchant.wallet.network,
            description: (_c = route.description) !== null && _c !== void 0 ? _c : merchant.business.name
        });
    }
    catch (error) {
        console.error("[PRICE_CHECK_ERROR]", error);
        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
            message: "Unable to fetch price information"
        });
    }
}));
exports.default = router;
