// server/src/routes/gatewayRouter.ts
import { Router, Request, Response } from "express";
import axios from "axios";
import Merchant from "../models/Merchant";

const router = Router();

router.all("*", async (req: Request, res: Response) => {
    try {
        // 1. Identify Merchant
        const merchantId = req.headers['x-merchant-id'] as string || req.query.merchantId as string;

        if (!merchantId) {
            return res.status(400).json({ 
                error: "MISSING_CONTEXT", 
                message: "Merchant ID missing. Pass x-merchant-id header." 
            });
        }

        // 2. Fetch config (lean for performance)
        const merchant = await Merchant.findOne({ merchantId }).lean();
        if (!merchant) return res.status(404).json({ error: "MERCHANT_NOT_FOUND" });

        // 3. Match Route (Flexible Path Matching)
        const incomingPath = req.path;
        const incomingAbsolute = `/api${req.path}`; // Logic for mounted routers

        const route = merchant.api.routes.find((r: any) => {
            const pathMatches = (r.path === incomingPath) || (r.path === incomingAbsolute);
            const methodMatches = r.method.toUpperCase() === req.method?.toUpperCase();
            return pathMatches && methodMatches;
        });

        if (!route) {
            return res.status(404).json({ 
                error: "ROUTE_NOT_REGISTERED", 
                message: "This path is not monetized by the merchant." 
            });
        }

        // 4. Execute Proxy
        const upstreamUrl = `${merchant.api.baseUrl}${route.path}`;
        
        console.log(`[GATEWAY] Proxying ${req.method} to: ${upstreamUrl}`);

        const response = await axios({
            method: req.method as any,
            url: upstreamUrl,
            params: req.query,
            data: req.body,
            timeout: 10000, // 🛡️ 10s timeout to prevent hanging
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Cronos-Merchant-Gateway/1.0'
            },
            validateStatus: () => true // Forward upstream errors (404, 500) to the client
        });

        // Forward the upstream response back to the Agent
        res.status(response.status).json(response.data);

    } catch (error: any) {
        console.error("[GATEWAY_CRITICAL_ERROR]", error.message);
        res.status(502).json({ 
            error: "BAD_GATEWAY", 
            message: "The upstream server could not be reached or timed out." 
        });
    }
});

export default router;