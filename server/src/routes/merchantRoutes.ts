import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'; // 🔒 Node.js native crypto for hashing
import Merchant from '../models/Merchant';
import { Transaction } from "../models/Transaction";

const router = express.Router();

// POST /api/merchants/register
router.post('/register', async (req: Request, res: Response): Promise<any> => {
    try {
        const { business, wallet, api, limits } = req.body;

        // 1. Strict Validation
        if (!business?.name || !business?.contactEmail || !wallet?.address) {
            return res.status(400).json({ message: 'Missing required registration details' });
        }

        // 2. Check for Duplicate Wallet (One merchant per wallet address)
        const existingMerchant = await Merchant.findOne({
            "wallet.address": wallet.address.toLowerCase()
        });

        if (existingMerchant) {
            return res.status(409).json({
                message: 'A merchant is already registered with this wallet address',
                merchantId: existingMerchant.merchantId
            });
        }

        // 3. Secure Key Generation
        const merchantId = uuidv4();
        const rawApiKey = `cmg_${crypto.randomBytes(24).toString('hex')}`; // Prefix for easier identification
        const apiKeyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

        // 4. Persistence
        const newMerchant = new Merchant({
            merchantId,
            security: {
                apiKeyHash: apiKeyHash, // Only store the hash!
            },
            business,
            wallet: {
                ...wallet,
                address: wallet.address.toLowerCase() // Canonical form
            },
            api,
            limits: {
                maxRequestsPerMinute: limits?.maxRequestsPerMinute || 60
            }
        });

        await newMerchant.save();

        // 5. Response (Send the rawApiKey ONLY ONCE)
        res.status(201).json({
            merchantId,
            apiKey: rawApiKey,
            message: 'Merchant registered successfully. Please save your API Key; it will not be shown again.'
        });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/merchants/:merchantId/sales
router.get("/:merchantId/sales", async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId } = req.params;

        // Optimized parallel query using Promise.all
        const [transactions, revenueAgg] = await Promise.all([
            Transaction.find({ merchantId })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(), // ⚡️ Performance: returns plain JS objects instead of Mongoose docs
            Transaction.aggregate([
                { $match: { merchantId } },
                { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
            ])
        ]);

        const totalRevenue = revenueAgg[0]?.total || 0;

        res.json({
            totalRevenue: Number(totalRevenue).toFixed(2),
            transactionCount: transactions.length,
            recentSales: transactions
        });
    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ error: "Failed to fetch sales" });
    }
});

// GET /api/merchants/lookup/:walletAddress
// ⚡️ Helpful for Frontend: Check if a user returning to the site already has a merchant profile
router.get("/lookup/:walletAddress", async (req: Request, res: Response): Promise<any> => {
    try {
        const merchant = await Merchant.findOne({
            "wallet.address": req.params.walletAddress.toLowerCase()
        }).select('merchantId business status').lean();

        if (!merchant) return res.status(404).json({ message: 'No merchant found' });
        res.json(merchant);
    } catch (error) {
        res.status(500).json({ message: 'Lookup failed' });
    }
});

// ==========================================
// PART 1: Monetized APIs Management Routes
// ==========================================

// Helper: Canonicalize paths (remove trailing slash, ensure leading slash)
const canonicalizePath = (path: string): string => {
    let cleanPath = path.trim();
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
    return cleanPath;
};

// GET /api/merchants/:merchantId/routes
router.get("/:merchantId/routes", async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId } = req.params;
        const merchant = await Merchant.findOne({ merchantId }).select('api.routes');

        if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

        res.json(merchant.api.routes);
    } catch (error) {
        console.error("Error fetching routes:", error);
        res.status(500).json({ message: 'Failed to fetch API routes' });
    }
});

// POST /api/merchants/:merchantId/routes
router.post("/:merchantId/routes", async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId } = req.params;
        const { method, path, price, currency } = req.body;

        // Validation
        if (!method || !path || !price || !currency) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (currency !== 'USDC') {
            return res.status(400).json({ message: 'Only USDC is supported at this time' });
        }

        const cleanPath = canonicalizePath(path);

        const merchant = await Merchant.findOne({ merchantId });
        if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

        // Check for duplicate path + method
        const exists = merchant.api.routes.some(r => r.path === cleanPath && r.method === method);
        if (exists) {
            return res.status(409).json({ message: `Route ${method} ${cleanPath} already exists` });
        }

        const newRoute = {
            method,
            path: cleanPath,
            price: price.toString(), // Ensure string
            currency,
            description: ''
        };

        merchant.api.routes.push(newRoute as any); // Type assertion if needed, schema allows this structure
        await merchant.save();

        res.status(201).json(merchant.api.routes);
    } catch (error) {
        console.error("Error adding route:", error);
        res.status(500).json({ message: 'Failed to add route' });
    }
});

// PUT /api/merchants/:merchantId/routes/:routeId
router.put("/:merchantId/routes/:routeId", async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId, routeId } = req.params;
        const { price, status } = req.body; // Only allowing price/status updates for now per requirements

        const merchant = await Merchant.findOne({ merchantId });
        if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

        const route = merchant.api.routes.find(r => (r as any)._id.toString() === routeId);
        if (!route) return res.status(404).json({ message: 'Route not found' });

        if (price !== undefined) route.price = price.toString();
        // If we add status active/disabled locally to the subdoc in future (currently schema doesn't have it explicitly on route, but task implies it.
        // Task says "Disable should NOT delete — just mark inactive".
        // Looking at schema: existing schema logic doesn't have 'active' flag on route.
        // Check schema lines 16-22 in Merchant.ts: No active flag.
        // Schema update might be needed or we just assume delete is the only way for now if strict on schema.
        // Wait, Task Requirement 1 says "Status (Active / Disabled)".
        // BUT Requirement 5 says "Existing merchant schema already contains...".
        // I will assume I CANNOT modify the schema structure too heavily if not requested, but I can add fields if Mongoose allows loose schema or if I update the interface.
        // Actually, let's double check the schema file content provided earlier.
        // File content lines 64-70: `routes: [{ ... }]` strict schema.
        // If I need to add 'active' status, I should probably add it to the schema.
        // Requirement 5 says "Do NOT change merchant identification logic", "Do NOT touch payment flow".
        // It doesn't explicitly forbid adding fields to route config.
        // I will add 'active' boolean to the route in schema first, or just manage it? 
        // Re-reading: "3. Edit & Disable... Disable should NOT delete".
        // So I MUST add a status field to the route schema. I'll do that in a separate tool call to be safe, but for now let's implement the logic assuming I'll fix the schema.

        // Actually, let's implement the properties update.
        // I will assume checking for `active` property.
        if (req.body.active !== undefined) {
            (route as any).active = req.body.active;
        }

        await merchant.save();
        res.json(merchant.api.routes);
    } catch (error) {
        console.error("Error updating route:", error);
        res.status(500).json({ message: 'Failed to update route' });
    }
});

// DELETE /api/merchants/:merchantId/routes/:routeId
router.delete("/:merchantId/routes/:routeId", async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId, routeId } = req.params;

        const merchant = await Merchant.findOne({ merchantId });
        if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

        // Mongoose pull to remove subdocument
        (merchant.api.routes as any).pull({ _id: routeId });
        await merchant.save();

        res.json(merchant.api.routes);
    } catch (error) {
        console.error("Error deleting route:", error);
        res.status(500).json({ message: 'Failed to delete route' });
    }
});

export default router;