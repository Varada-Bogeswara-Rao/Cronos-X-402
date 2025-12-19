import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

/**
 * GET /api/paid/price
 * Paid proxy to CoinGecko
 */
router.get("/paid/price", async (req: Request, res: Response) => {
    try {
        // Call REAL external API
        const response = await axios.get(
            "https://api.coingecko.com/api/v3/simple/price",
            {
                params: {
                    ids: "bitcoin",
                    vs_currencies: "usd"
                },
                timeout: 5000
            }
        );

        return res.status(200).json({
            source: "coingecko",
            data: response.data
        });

    } catch (error) {
        console.error("[PAID_PROXY_ERROR]", error);

        return res.status(502).json({
            error: "UPSTREAM_API_ERROR",
            message: "Failed to fetch data from external API"
        });
    }
});

export default router;
