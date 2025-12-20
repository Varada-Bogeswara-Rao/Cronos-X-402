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

export default router;