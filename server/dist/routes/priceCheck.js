"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Merchant_1 = __importDefault(require("../models/Merchant"));
const router = (0, express_1.Router)();
const canonicalPath = (p) => (p.startsWith("/") ? p : `/${p}`).replace(/\/$/, "") || "/";
router.post("/", async (req, res) => {
    console.log("🔥 PRICE CHECK ROUTE HIT");
    const { merchantId, method, path } = req.body;
    console.log("[RAW INPUT]", { merchantId, method, path });
    const merchant = await Merchant_1.default.findOne({ merchantId }).lean();
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
    // ⚡️ BUG FIX: Respect the "Active" Status!
    if (route.active === false) {
        return res.status(400).json({
            error: "ROUTE_DISABLED",
            message: "Api has been disabled"
        });
    }
    // [CACHE INVALIDATION]
    // Include Last-Modified/ETag equivalent logic so middleware can intelligently invalidate.
    const priceVersion = merchant.metadata?.updatedAt
        ? Math.floor(new Date(merchant.metadata.updatedAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
    return res.json({
        merchantId,
        price: route.price,
        currency: route.currency,
        payTo: merchant.wallet.address,
        network: merchant.wallet.network,
        version: priceVersion
    });
});
exports.default = router;
