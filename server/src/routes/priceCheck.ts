import { Router, Request, Response } from "express";
import Merchant from "../models/Merchant";

const router = Router();

const canonicalPath = (p: string) =>
  (p.startsWith("/") ? p : `/${p}`).replace(/\/$/, "") || "/";

router.post("/", async (req: Request, res: Response) => {
  console.log("🔥 PRICE CHECK ROUTE HIT");

  const { merchantId, method, path } = req.body;

  console.log("[RAW INPUT]", { merchantId, method, path });

  const merchant = await Merchant.findOne({ merchantId }).lean();
  console.log("[MERCHANT FOUND]", !!merchant);

  if (!merchant) {
    return res.status(404).json({ error: "MERCHANT_NOT_FOUND" });
  }

  const canonicalPath = (p: string) =>
    (p.startsWith("/") ? p : `/${p}`).replace(/\/$/, "") || "/";

  const normalizedPath = canonicalPath(path.split("?")[0]);
  const normalizedMethod = method.toUpperCase();

  console.log("[NORMALIZED]", {
    normalizedMethod,
    normalizedPath,
    dbRoutes: merchant.api.routes.map(r => ({
      method: r.method,
      path: r.path,
      canonical: canonicalPath(r.path)
    }))
  });

  const route = merchant.api.routes.find(
    r =>
      r.method.toUpperCase() === normalizedMethod &&
      canonicalPath(r.path) === normalizedPath
  );

  console.log("[ROUTE MATCH RESULT]", !!route);

  if (!route) {
    return res.status(402).json({
      error: "ROUTE_NOT_REGISTERED",
      message: "Debug logs above show mismatch"
    });
  }

  return res.json({
    merchantId,
    price: route.price,
    currency: route.currency,
    payTo: merchant.wallet.address,
    network: merchant.wallet.network
  });
});

export default router;
