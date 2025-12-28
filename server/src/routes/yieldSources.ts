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

export default router;
