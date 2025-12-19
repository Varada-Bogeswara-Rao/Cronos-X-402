import { Router, Request, Response } from "express";
import Merchant from "../models/Merchant";

const router = Router();

/**
 * POST /api/price-check
 * Authoritative price lookup for x402 middleware
 */
// Route is mounted at /api/price-check in server.ts, so this becomes /api/price-check/
router.post("/", async (req: Request, res: Response) => {
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
        const merchant = await Merchant.findOne({ merchantId }).lean();

        if (!merchant) {
            return res.status(404).json({
                error: "MERCHANT_NOT_FOUND",
                message: "Merchant does not exist"
            });
        }

        // ----------------------------
        // 3. Merchant status checks
        // ----------------------------
        if (!merchant.status?.active || merchant.status?.suspended) {
            return res.status(403).json({
                error: "MERCHANT_INACTIVE",
                message: "Merchant is inactive or suspended"
            });
        }

        // ----------------------------
        // 4. Route lookup
        // ----------------------------
        const route = merchant.api.routes.find(
            (r: any) =>
                r.method.toUpperCase() === method.toUpperCase() &&
                r.path === path
        );

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
            description: route.description ?? merchant.business.name
        });

    } catch (error) {
        console.error("[PRICE_CHECK_ERROR]", error);

        return res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
            message: "Unable to fetch price information"
        });
    }
});

export default router;
