import { Router, Request, Response } from "express";
import axios from "axios";
import Merchant from "../models/Merchant";
import { paymentMiddleware } from "../middleware/paymentMiddleware";

const router = Router();

// [GUARDRAIL] Ensure Sandbox is not mounted on root in production
// This is a router-level check, but the mounting path is controlled in server.ts
// We add a flag to the request to mark it as sandbox
router.use((req, res, next) => {
    (req as any).isSandbox = true;

    // Explicit Header to tag all downstream analytics
    req.headers['x-is-sandbox'] = 'true';

    console.log(`[SANDBOX] 🧪 Request received: ${req.method} ${req.path}`);
    next();
});

// matches /api/sandbox/:merchantId/*
router.all("/:merchantId/*", async (req: Request, res: Response) => {
    try {
        const { merchantId } = req.params;
        // The rest of the path after merchantId
        // req.path will be /:merchantId/some/path
        // We need to strip the /:merchantId part
        const pathParts = req.path.split('/'); // ['', 'merchantId', 'some', 'path']
        let actualPath = '/' + pathParts.slice(2).join('/'); // /some/path

        // [FIX] Normalize Trailing Slashes
        if (actualPath.length > 1 && actualPath.endsWith('/')) {
            actualPath = actualPath.slice(0, -1);
        }

        if (!merchantId) {
            return res.status(400).json({ error: "INVALID_SANDBOX_REQUEST", message: "Merchant ID missing from URL" });
        }

        // 1. Fetch Merchant
        const merchant = await Merchant.findOne({ merchantId }).lean();
        if (!merchant) return res.status(404).json({ error: "MERCHANT_NOT_FOUND" });

        // 2. Identify Route
        // We match against the STRIPPED path
        const route = merchant.api.routes.find((r: any) => {
            const matchesPath = (r.path === actualPath);
            const matchesMethod = r.method.toUpperCase() === req.method?.toUpperCase();
            return matchesPath && matchesMethod;
        });

        console.log(`[DEBUG] Sandbox Route Match:
            > Request Path: ${actualPath}
            > Request Method: ${req.method}
            > Merchant Routes: ${merchant.api.routes.map((r: any) => `${r.method} ${r.path}`).join(", ")}
            > MATCH FOUND: ${!!route}
        `);

        if (!route) {
            // [UX] Helpful error for sandbox testing
            return res.status(404).json({
                error: "ROUTE_NOT_REGISTERED",
                message: `The path '${actualPath}' is not registered for this merchant. Check your Dashboard configuration.`
            });
        }

        // 3. [SECURITY] Apply Payment Middleware
        // We wrap the middleware in a promise to await it inline

        // [FIX] Middleware relies on req.path. We must rewrite req.url to match the registered route path.
        // Save original URL to restore if needed (though we proxy upstreamUrl anyway)
        const originalUrl = req.url;
        req.url = actualPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');

        const middleware = paymentMiddleware({
            merchantId,
            gatewayUrl: `${req.protocol}://${req.get('host')}`, // Self-referential for sandbox
            facilitatorUrl: `${req.protocol}://${req.get('host')}`,
            network: "cronos-testnet" // Force testnet for sandbox
        });

        // Execute Middleware manually
        await new Promise<void>((resolve, reject) => {
            middleware(req, res, (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // 4. [ANALYTICS] Tagging
        // We will pass a flag to the upstream or log it here.
        // For now, we just ensure we don't block.

        // 5. Proxy Execution
        const upstreamUrl = `${merchant.api.baseUrl}${actualPath}`;
        console.log(`[SANDBOX] ✅ Payment Verified. Proxying to: ${upstreamUrl}`);

        const response = await axios({
            method: req.method as any,
            url: upstreamUrl,
            params: req.query,
            data: req.body,
            timeout: 5000, // Shorter timeout for sandbox
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Cronos-Merchant-Sandbox/1.0',
                'X-Is-Sandbox': 'true', // Tag for upstream
                'x-merchant-id': merchantId // [FIX] Inject ID for upstream context
            },
            validateStatus: () => true
        });

        res.status(response.status).json(response.data);

    } catch (error: any) {
        // [UX] Middleware might send a response (402), if so, we are done.
        if (res.headersSent) return;

        console.error("[SANDBOX_ERROR]", error.message);
        res.status(502).json({
            error: "SANDBOX_GATEWAY_ERROR",
            message: "Upstream unavailable or internal error.",
            details: error.message
        });
    }
});

export default router;
