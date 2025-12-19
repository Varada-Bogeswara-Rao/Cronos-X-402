import { Router, Request, Response } from "express";
import Merchant from "../models/Merchant";

const router = Router();

/**
 * POST /api/facilitator/verify
 * Verifies an x402 payment proof
 */
router.post("/facilitator/verify", async (req: Request, res: Response) => {
    try {
        const {
            merchantId,
            paymentProof,
            expectedAmount,
            currency
        } = req.body;

        // ----------------------------
        // 1. Validate request
        // ----------------------------
        if (!merchantId || !paymentProof || !expectedAmount || !currency) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "Missing required verification fields"
            });
        }

        // ----------------------------
        // 2. Fetch merchant (sanity check)
        // ----------------------------
        const merchant = await Merchant.findOne({ merchantId }).lean();

        if (!merchant) {
            return res.status(404).json({
                error: "MERCHANT_NOT_FOUND",
                message: "Merchant does not exist"
            });
        }

        if (!merchant.status?.active || merchant.status?.suspended) {
            return res.status(403).json({
                error: "MERCHANT_INACTIVE",
                message: "Merchant is inactive or suspended"
            });
        }

        // ----------------------------
        // 3. MOCK payment verification
        // ----------------------------
        // ⚠️ Hackathon mode:
        // In production, replace this with:
        // - Cronos RPC call
        // - ERC20 Transfer log parsing
        // - Recipient + amount verification

        const mockChainVerification = {
            txHash: paymentProof,
            payer: "0xMOCK_USER_ADDRESS",
            amount: expectedAmount,
            currency,
            network: merchant.wallet.network,
            recipient: merchant.wallet.address
        };

        // ----------------------------
        // 4. Final consistency checks
        // ----------------------------
        if (mockChainVerification.amount !== expectedAmount) {
            return res.status(402).json({
                verified: false,
                error: "AMOUNT_MISMATCH",
                message: "Payment amount mismatch"
            });
        }

        if (mockChainVerification.currency !== currency) {
            return res.status(402).json({
                verified: false,
                error: "CURRENCY_MISMATCH",
                message: "Currency mismatch"
            });
        }

        // ----------------------------
        // 5. Success response (receipt)
        // ----------------------------
        return res.status(200).json({
            verified: true,
            txHash: mockChainVerification.txHash,
            payer: mockChainVerification.payer,
            amount: mockChainVerification.amount,
            currency: mockChainVerification.currency,
            network: mockChainVerification.network
        });

    } catch (error) {
        console.error("[FACILITATOR_VERIFY_ERROR]", error);

        return res.status(500).json({
            error: "FACILITATOR_ERROR",
            message: "Unable to verify payment"
        });
    }
});

export default router;
