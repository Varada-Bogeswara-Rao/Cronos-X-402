import express from "express";
import { YieldSource } from "../models/YieldSource";

const router = express.Router();

/**
 * GET /api/yield-sources
 * Returns all monitored yield sources with read-only health data.
 */
router.get("/", async (req, res) => {
    try {
        const sources = await YieldSource.find({});
        res.json(sources);
    } catch (error) {
        console.error("Failed to fetch yield sources:", error);
        res.status(500).json({ error: "Failed to fetch yield sources" });
    }
});
import { StrategyEngine } from "../services/StrategyEngine";

const engine = new StrategyEngine(); // Uses env key or random

/**
 * GET /api/yield-sources/decision
 * Request a signed Facilitator decision for a specific source context.
 * Query: ?sourceId=...&agent=...
 */
router.get("/decision", async (req, res) => {
    try {
        const { sourceId, agent } = req.query;

        if (!sourceId || !agent) {
            return res.status(400).json({ error: "Missing sourceId or agent" });
        }

        const decision = await engine.evaluate(sourceId as string, agent as string);
        res.json(decision);
    } catch (error: any) {
        console.error("Failed to generate decision:", error);
        res.status(500).json({ error: error.message || "Failed to generate decision" });
    }
});

export default router;
