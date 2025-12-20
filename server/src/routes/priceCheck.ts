import { Router, Request, Response } from "express";
import Merchant from "../models/Merchant";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId, method, path } = req.body;

        if (!merchantId || !method || !path) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "merchantId, method, and path are required"
            });
        }

        // 1. Find Merchant by ID first (Keep it simple to debug)
        const merchant = await Merchant.findOne({ merchantId }).lean();

        if (!merchant) {
            return res.status(404).json({ 
                error: "MERCHANT_NOT_FOUND",
                message: `No merchant found with ID: ${merchantId}`
            });
        }

        // 2. Check Status
        if (!merchant.status?.active || merchant.status?.suspended) {
            return res.status(403).json({ error: "MERCHANT_INACTIVE" });
        }

        // 3. Robust Route Matching
        // Extract base path (removes ?ids=bitcoin etc.)
        const basePath = path.split('?')[0]; 
        const normalizedReqPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
        const normalizedMethod = method.toUpperCase();

        const route = merchant.api.routes.find((r: any) => {
            const dbPath = r.path.startsWith('/') ? r.path : `/${r.path}`;
            return dbPath === normalizedReqPath && r.method.toUpperCase() === normalizedMethod;
        });

        if (!route) {
            console.log(`[DEBUG] Route mismatch. Req: ${normalizedReqPath}. DB has:`, merchant.api.routes.map(r => r.path));
            return res.status(404).json({ 
                error: "ROUTE_NOT_REGISTERED",
                message: `The path ${normalizedReqPath} is not monetized by this merchant.`
            });
        }

        // 4. Return Authoritative Data
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
            error: "INTERNAL_ERROR",
            message: error.message
        });
    }
});

export default router;