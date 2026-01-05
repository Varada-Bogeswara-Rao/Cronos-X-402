import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import Merchant from '../models/Merchant';
import { Transaction } from "../models/Transaction";

const router = express.Router();

// --------------------------------------------------------------------------
// 🛡️ MIDDLEWARE: Verify Wallet Signature
// --------------------------------------------------------------------------
// The frontend must send headers:
// x-signature: The signature of the message
// x-timestamp: The timestamp included in the message
// x-merchant-id: The merchant's ID
//
// Message Format: "Update Routes for Merchant <merchantId> at <timestamp>"
// --------------------------------------------------------------------------
const verifyWalletSignature = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const signature = req.headers['x-signature'] as string;
        const timestamp = req.headers['x-timestamp'] as string;
        const merchantId = req.params.merchantId || req.body.merchantId;

        if (!signature || !timestamp || !merchantId) {
            return res.status(401).json({ error: "MISSING_AUTH", message: "Missing signature, timestamp, or merchantId" });
        }

        // 1. Prevent Replay Attacks (Signature must be recent, e.g., within 5 mins)
        const sentTime = parseInt(timestamp);
        const now = Date.now();
        if (isNaN(sentTime) || Math.abs(now - sentTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: "EXPIRED_SIGNATURE", message: "Signature expired. Please try again." });
        }

        // 2. Fetch Merchant to get the REAL Wallet Address
        // We trust the DB, not the user's input for the address
        const merchant = await Merchant.findOne({ merchantId }).select('wallet.address');
        if (!merchant) {
            return res.status(404).json({ error: "MERCHANT_NOT_FOUND" });
        }

        // 3. Reconstruct the Message
        const message = `Update Routes for Merchant ${merchantId} at ${timestamp}`;

        // 4. Recover Address from Signature
        const recoveredAddress = ethers.verifyMessage(message, signature);

        // 5. Compare
        if (recoveredAddress.toLowerCase() !== merchant.wallet.address.toLowerCase()) {
            return res.status(403).json({
                error: "INVALID_SIGNATURE",
                message: "Wallet signature does not match the merchant owner."
            });
        }

        next();

    } catch (error) {
        console.error("Signature Verification Error:", error);
        return res.status(401).json({ error: "AUTH_FAILED", message: "Authentication failed" });
    }
};


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

        // 3. Create ID
        const merchantId = uuidv4();
        // 🔒 No more API Keys! We rely on wallet signatures.

        // 4. Persistence
        const newMerchant = new Merchant({
            merchantId,
            security: {
                // apiKeyHash removed
                ipWhitelist: []
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

        // 5. Response
        res.status(201).json({
            merchantId,
            message: 'Merchant registered successfully. You can now manage routes using your wallet.'
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
        const incomingAddress = req.params.walletAddress;
        console.log(`🔎 LOOKUP REQUEST: ${incomingAddress}`);

        const query = {
            "wallet.address": incomingAddress.toLowerCase()
        };
        console.log(`🔎 QUERY:`, JSON.stringify(query));

        const merchant = await Merchant.findOne(query).select('merchantId business status').lean();

        if (!merchant) {
            console.log("❌ LOOKUP FAILED: Merchant not found in DB.");
            return res.status(404).json({ message: 'No merchant found' });
        }

        console.log(`✅ LOOKUP SUCCESS: Found ${merchant.merchantId}`);
        res.json(merchant);
    } catch (error) {
        console.error("❌ LOOKUP ERROR:", error);
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
// Publicly readable so the dashboard (and paying users) can see what's available
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
//  Secured by Wallet Signature
router.post("/:merchantId/routes", verifyWalletSignature, async (req: Request, res: Response): Promise<any> => {
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
            description: '',
            active: true
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
// 🔒 Secured by Wallet Signature
router.put("/:merchantId/routes/:routeId", verifyWalletSignature, async (req: Request, res: Response): Promise<any> => {
    try {
        const { merchantId, routeId } = req.params;
        const { price, status, active } = req.body;

        const merchant = await Merchant.findOne({ merchantId });
        if (!merchant) return res.status(404).json({ message: 'Merchant not found' });

        const route = merchant.api.routes.find(r => (r as any)._id.toString() === routeId);
        if (!route) return res.status(404).json({ message: 'Route not found' });

        if (price !== undefined) route.price = price.toString();
        if (active !== undefined) (route as any).active = active;
        if (status !== undefined) (route as any).active = (status === 'active'); // Backwards compact

        await merchant.save();
        res.json(merchant.api.routes);
    } catch (error) {
        console.error("Error updating route:", error);
        res.status(500).json({ message: 'Failed to update route' });
    }
});

// DELETE /api/merchants/:merchantId/routes/:routeId
// 🔒 Secured by Wallet Signature
router.delete("/:merchantId/routes/:routeId", verifyWalletSignature, async (req: Request, res: Response): Promise<any> => {
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