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
const canonicalPath = (p) => (p.startsWith("/") ? p : `/${p}`).replace(/\/$/, "") || "/";
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🔥 PRICE CHECK ROUTE HIT");
    const { merchantId, method, path } = req.body;
    console.log("[RAW INPUT]", { merchantId, method, path });
    const merchant = yield Merchant_1.default.findOne({ merchantId }).lean();
    console.log("[MERCHANT FOUND]", !!merchant);
    if (!merchant) {
        return res.status(404).json({ error: "MERCHANT_NOT_FOUND" });
    }
    const canonicalPath = (p) => (p.startsWith("/") ? p : `/${p}`).replace(/\/$/, "") || "/";
    const normalizedPath = canonicalPath(path.split("?")[0]);
    const normalizedMethod = method.toUpperCase();
    console.log("[NORMALIZED]", {
        normalizedMethod,
        normalizedPath,
        dbRoutes: merchant.api.routes.map(r => ({
            method: r.method,
            path: r.path,
            canonical: canonicalPath(r.path)
        }))
    });
    const route = merchant.api.routes.find(r => r.method.toUpperCase() === normalizedMethod &&
        canonicalPath(r.path) === normalizedPath);
    console.log("[ROUTE MATCH RESULT]", !!route);
    if (!route) {
        return res.status(402).json({
            error: "ROUTE_NOT_REGISTERED",
            message: "Debug logs above show mismatch"
        });
    }
    return res.json({
        merchantId,
        price: route.price,
        currency: route.currency,
        payTo: merchant.wallet.address,
        network: merchant.wallet.network
    });
}));
exports.default = router;
