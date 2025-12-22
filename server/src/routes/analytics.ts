import { Router, Request, Response } from "express";
import Transaction from "../models/Transaction";
import mongoose from "mongoose";

const router = Router();

// GET /api/analytics/:merchantId
// Returns global stats (Revenue, Count, Avg Price)
router.get("/:merchantId", async (req: Request, res: Response) => {
    try {
        const { merchantId } = req.params;

        const stats = await Transaction.aggregate([
            { $match: { merchantId } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: { $toDouble: "$amount" } },
                    totalRequests: { $sum: 1 },
                    avgPrice: { $avg: { $toDouble: "$amount" } }
                }
            }
        ]);

        // Last 24h Revenue
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const revenue24h = await Transaction.aggregate([
            { $match: { merchantId, createdAt: { $gte: oneDayAgo } } },
            { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
        ]);

        // Last 7d Revenue
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const revenue7d = await Transaction.aggregate([
            { $match: { merchantId, createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
        ]);

        res.json({
            totalRevenue: stats[0]?.totalRevenue || 0,
            totalRequests: stats[0]?.totalRequests || 0,
            avgPrice: stats[0]?.avgPrice || 0,
            revenue24h: revenue24h[0]?.total || 0,
            revenue7d: revenue7d[0]?.total || 0
        });
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// GET /api/analytics/:merchantId/routes
// Returns per-route performance
router.get("/:merchantId/routes", async (req: Request, res: Response) => {
    try {
        const { merchantId } = req.params;

        const routeStats = await Transaction.aggregate([
            { $match: { merchantId } },
            {
                $group: {
                    _id: { path: "$path", method: "$method" },
                    totalRevenue: { $sum: { $toDouble: "$amount" } },
                    requestCount: { $sum: 1 },
                    avgPrice: { $avg: { $toDouble: "$amount" } },
                    lastTransaction: { $max: "$createdAt" }
                }
            },
            { $sort: { totalRevenue: -1 } } // Highest revenue first
        ]);

        res.json(routeStats.map(s => ({
            path: s._id.path,
            method: s._id.method,
            totalRevenue: s.totalRevenue,
            requestCount: s.requestCount,
            avgPrice: s.avgPrice,
            lastTransaction: s.lastTransaction
        })));

    } catch (error) {
        console.error("Route Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch route analytics" });
    }
});

export default router;
