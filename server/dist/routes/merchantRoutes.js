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
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto")); // 🔒 Node.js native crypto for hashing
const Merchant_1 = __importDefault(require("../models/Merchant"));
const Transaction_1 = require("../models/Transaction");
const router = express_1.default.Router();
// POST /api/merchants/register
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { business, wallet, api, limits } = req.body;
        // 1. Strict Validation
        if (!(business === null || business === void 0 ? void 0 : business.name) || !(business === null || business === void 0 ? void 0 : business.contactEmail) || !(wallet === null || wallet === void 0 ? void 0 : wallet.address)) {
            return res.status(400).json({ message: 'Missing required registration details' });
        }
        // 2. Check for Duplicate Wallet (One merchant per wallet address)
        const existingMerchant = yield Merchant_1.default.findOne({
            "wallet.address": wallet.address.toLowerCase()
        });
        if (existingMerchant) {
            return res.status(409).json({
                message: 'A merchant is already registered with this wallet address',
                merchantId: existingMerchant.merchantId
            });
        }
        // 3. Secure Key Generation
        const merchantId = (0, uuid_1.v4)();
        const rawApiKey = `cmg_${crypto_1.default.randomBytes(24).toString('hex')}`; // Prefix for easier identification
        const apiKeyHash = crypto_1.default.createHash('sha256').update(rawApiKey).digest('hex');
        // 4. Persistence
        const newMerchant = new Merchant_1.default({
            merchantId,
            security: {
                apiKeyHash: apiKeyHash, // Only store the hash!
            },
            business,
            wallet: Object.assign(Object.assign({}, wallet), { address: wallet.address.toLowerCase() // Canonical form
             }),
            api,
            limits: {
                maxRequestsPerMinute: (limits === null || limits === void 0 ? void 0 : limits.maxRequestsPerMinute) || 60
            }
        });
        yield newMerchant.save();
        // 5. Response (Send the rawApiKey ONLY ONCE)
        res.status(201).json({
            merchantId,
            apiKey: rawApiKey,
            message: 'Merchant registered successfully. Please save your API Key; it will not be shown again.'
        });
    }
    catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}));
// GET /api/merchants/:merchantId/sales
router.get("/:merchantId/sales", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { merchantId } = req.params;
        // Optimized parallel query using Promise.all
        const [transactions, revenueAgg] = yield Promise.all([
            Transaction_1.Transaction.find({ merchantId })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(), // ⚡️ Performance: returns plain JS objects instead of Mongoose docs
            Transaction_1.Transaction.aggregate([
                { $match: { merchantId } },
                { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
            ])
        ]);
        const totalRevenue = ((_a = revenueAgg[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
        res.json({
            totalRevenue: Number(totalRevenue).toFixed(2),
            transactionCount: transactions.length,
            recentSales: transactions
        });
    }
    catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ error: "Failed to fetch sales" });
    }
}));
// GET /api/merchants/lookup/:walletAddress
// ⚡️ Helpful for Frontend: Check if a user returning to the site already has a merchant profile
router.get("/lookup/:walletAddress", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const merchant = yield Merchant_1.default.findOne({
            "wallet.address": req.params.walletAddress.toLowerCase()
        }).select('merchantId business status').lean();
        if (!merchant)
            return res.status(404).json({ message: 'No merchant found' });
        res.json(merchant);
    }
    catch (error) {
        res.status(500).json({ message: 'Lookup failed' });
    }
}));
exports.default = router;
