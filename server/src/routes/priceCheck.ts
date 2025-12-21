import { Router, Request, Response } from "express";
import Merchant from "../models/Merchant";

const router = Router();

const canonicalPath = (p: string) =>
  (p.startsWith("/") ? p : `/${p}`).replace(/\/$/, "") || "/";

router.post("/", async (req: Request, res: Response) => {
  try {
    const { merchantId, method, path } = req.body;

    if (!merchantId || !method || !path) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "merchantId, method, and path are required"
      });
    }

    // 1. Fetch merchant
    const merchant = await Merchant.findOne({ merchantId }).lean();

    if (!merchant) {
      return res.status(404).json({
        error: "MERCHANT_NOT_FOUND",
        message: `No merchant found with ID: ${merchantId}`
      });
    }

    if (!merchant.status?.active || merchant.status?.suspended) {
      return res.status(403).json({ error: "MERCHANT_INACTIVE" });
    }

    // 2. Normalize request
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = canonicalPath(path.split("?")[0]);

    // 3. Route match
    const route = merchant.api.routes.find((r: any) => {
      return (
        r.method.toUpperCase() === normalizedMethod &&
        canonicalPath(r.path) === normalizedPath
      );
    });

    if (!route) {
      console.error("[PRICE_CHECK_ROUTE_MISMATCH]", {
        requested: { normalizedMethod, normalizedPath },
        registered: merchant.api.routes.map(r => ({
          method: r.method,
          path: r.path
        }))
      });

      return res.status(402).json({
        error: "ROUTE_NOT_REGISTERED",
        message: `The path ${normalizedPath} is not monetized by this merchant.`
      });
    }

    // 4. Authoritative response
    return res.status(200).json({
      merchantId: merchant.merchantId,
      price: route.price,
      currency: route.currency,
      payTo: merchant.wallet.address,
      network: merchant.wallet.network,
      description: route.description || merchant.business?.name || "Paid API"
    });

  } catch (error: any) {
    console.error("[PRICE_CHECK_ERROR]", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Price check failed"
    });
  }
});

export default router;
