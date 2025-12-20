import { Router, Request, Response } from "express";
import Merchant from "../models/Merchant";

const router = Router();

// Cache settings (Optional: use Redis for ultra-low latency)
// const PRICE_CACHE_TTL = 300; 

/**
 * POST /api/price-check
 * Optimized authoritative price lookup
 */
router.post("/", async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId, method, path } = req.body;

        // 1. Faster Validation (Validation at the edge)
        if (!merchantId || !method || !path) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "merchantId, method, and path are required"
            });
        }

        // 2. Normalize inputs immediately
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const normalizedMethod = method.toUpperCase();

        // 3. High Performance Query (Projection & Filtering)
        // Instead of fetching the WHOLE merchant object and then searching the array in JS,
        // we use MongoDB's $elemMatch to find ONLY the specific route we need.
        const merchant = await Merchant.findOne(
            { 
                merchantId, 
                "status.active": true,
                "status.suspended": false,
                api: { 
                    $elemMatch: { 
                        "routes.path": normalizedPath, 
                        "routes.method": normalizedMethod 
                    } 
                } 
            },
            {
                // Projection: Only fetch the fields we actually need
                "merchantId": 1,
                "wallet.address": 1,
                "wallet.network": 1,
                "business.name": 1,
                "api.routes.$": 1 // Only return the matching route from the array
            }
        ).lean();

        // 4. Detailed Error Reporting for Developers
        if (!merchant) {
            // Check if merchant exists at all to provide better error feedback
            const merchantExists = await Merchant.exists({ merchantId });
            if (!merchantExists) {
                return res.status(404).json({ error: "MERCHANT_NOT_FOUND" });
            }
            return res.status(403).json({ 
                error: "ROUTE_UNAVAILABLE", 
                message: "Route is not monetized or merchant is inactive" 
            });
        }

        // 5. Build authoritative response
        const route = merchant.api.routes[0]; // Projection $ ensures the match is at index 0

        return res.status(200).json({
            merchantId: merchant.merchantId,
            price: route.price,
            currency: route.currency,
            payTo: merchant.wallet.address,
            network: merchant.wallet.network,
            description: route.description || merchant.business.name
        });

    } catch (error: any) {
        console.error("[PRICE_CHECK_ERROR]", error.message);
        return res.status(500).json({
            error: "PRICE_ORACLE_FAULT",
            message: "Internal gateway error during price lookup"
        });
    }
});

export default router;