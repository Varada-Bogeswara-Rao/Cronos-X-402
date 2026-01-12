
import express from "express";
import PaymentAttempt from "../models/PaymentAttempt";

const router = express.Router();

// POST /api/analytics/log
// Used by the SDK to report decisions (or by the server to log verified payments)
router.post("/log", async (req, res) => {
    try {
        const {
            agentAddress,
            url,
            merchantId,
            amount,
            currency,
            decision,
            reason,
            txHash,
            chainId
        } = req.body;

        if (!agentAddress || !merchantId || !decision) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const log = new PaymentAttempt({
            agentAddress,
            url,
            merchantId,
            amount,
            currency: currency || "USDC",
            decision,
            reason,
            txHash,
            chainId: chainId || 25
        });

        await log.save();
        res.status(201).json({ success: true, id: log._id });
    } catch (err: any) {
        console.error("Analytics Log Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/history
// Used by the Dashboard to show tables
router.get("/history", async (req, res) => {
    try {
        const { agentAddress, merchantId, limit } = req.query;
        const query: any = {};

        if (agentAddress) query.agentAddress = agentAddress;
        if (merchantId) query.merchantId = merchantId;

        const logs = await PaymentAttempt.find(query)
            .sort({ timestamp: -1 })
            .limit(Number(limit) || 50);

        res.json(logs);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
