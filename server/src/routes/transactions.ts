import { Router, Request, Response } from "express";
import Transaction from "../models/Transaction";

const router = Router();

// GET /api/transactions/:merchantId
router.get("/:merchantId", async (req: Request, res: Response) => {
    try {
        const { merchantId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            Transaction.find({ merchantId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Transaction.countDocuments({ merchantId })
        ]);

        res.json({
            transactions,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Transactions Error:", error);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

export default router;
