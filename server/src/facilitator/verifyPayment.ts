import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import Transaction from "../models/Transaction";
import Merchant from "../models/Merchant";

const router = Router();

const CONFIRMATIONS_REQUIRED =
    process.env.NODE_ENV === "production" ? 3 : 1;

const getProvider = () => {
    return new ethers.JsonRpcProvider(
        process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org",
        undefined,
        { staticNetwork: true }
    );
};

// 🔒 Canonical path helper (SINGLE SOURCE OF TRUTH)
const canonicalPath = (path: string) =>
    path.replace(/\/$/, "") || "/";

router.post("/facilitator/verify", async (req: Request, res: Response) => {
    try {
        const merchantId = req.headers["x-merchant-id"] as string;

        const {
            paymentProof,
            expectedAmount,
            currency,
            path,
            method
        } = req.body;

        if (!merchantId || !paymentProof || !expectedAmount || !currency || !path || !method) {
            return res.status(400).json({
                error: "INVALID_REQUEST",
                message: "Missing required verification fields"
            });
        }

        const cleanPath = canonicalPath(path);
        const cleanMethod = method.toUpperCase();

        console.log("[FACILITATOR] verify request", {
            merchantId,
            cleanMethod,
            cleanPath,
            currency,
            expectedAmount
        });

        // --------------------------------------------------
        // 1. Replay Protection
        // --------------------------------------------------
        const existingTx = await Transaction.findOne({ txHash: paymentProof }).lean();
        if (existingTx) {
            return res.status(402).json({
                verified: false,
                error: "REPLAY_DETECTED"
            });
        }

        // --------------------------------------------------
        // 2. Fetch Merchant
        // --------------------------------------------------
        const merchant = await Merchant.findOne({ merchantId }).lean();
        if (!merchant || !merchant.status?.active) {
            return res.status(403).json({
                error: "MERCHANT_INACTIVE"
            });
        }

        // --------------------------------------------------
        // 3. 🔥 ROUTE REGISTRATION CHECK (MISSING EARLIER)
        // --------------------------------------------------
        const route = merchant.api?.routes?.find(
            (r: any) =>
                r.method === cleanMethod &&
                canonicalPath(r.path) === cleanPath
        );

        if (!route) {
            console.error("[FACILITATOR] ROUTE_NOT_REGISTERED", {
                cleanMethod,
                cleanPath,
                registeredRoutes: merchant.api?.routes
            });

            return res.status(402).json({
                error: "ROUTE_NOT_REGISTERED",
                message: "This path is not monetized by the merchant."
            });
        }

        // --------------------------------------------------
        // 4. Chain Verification
        // --------------------------------------------------
        const provider = getProvider();
        const receipt = await provider.getTransactionReceipt(paymentProof);
        if (!receipt || receipt.status !== 1) {
            return res.status(402).json({
                verified: false,
                error: "TX_NOT_FOUND_OR_FAILED"
            });
        }

        const tx = await provider.getTransaction(paymentProof);
        if (!tx || !tx.from) {
            return res.status(402).json({
                verified: false,
                error: "TX_INVALID"
            });
        }

        const payer = tx.from.toLowerCase();
        const merchantAddress = merchant.wallet.address.toLowerCase();

        const network = await provider.getNetwork();
        const expectedChainId = BigInt(process.env.CRONOS_CHAIN_ID || 338);
        if (network.chainId !== expectedChainId) {
            return res.status(402).json({ error: "WRONG_NETWORK" });
        }

        // --------------------------------------------------
        // 5. Payment Verification
        // --------------------------------------------------
        let verified = false;

        if (currency === "USDC") {
            const usdcAddress = (
                process.env.USDC_CONTRACT_ADDRESS ||
                "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0"
            ).toLowerCase();

            const expectedRawAmount = ethers.parseUnits(
                expectedAmount.toString(),
                6
            );

            const iface = new ethers.Interface([
                "event Transfer(address indexed from, address indexed to, uint256 value)"
            ]);

            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== usdcAddress) continue;

                try {
                    const parsed = iface.parseLog(log);
                    if (
                        parsed &&
                        parsed.args.from.toLowerCase() === payer &&
                        parsed.args.to.toLowerCase() === merchantAddress &&
                        parsed.args.value >= expectedRawAmount
                    ) {
                        verified = true;
                        break;
                    }
                } catch { }
            }
        }

        if (currency === "CRO" || currency === "TCRO") {
            if (
                tx.to?.toLowerCase() === merchantAddress &&
                tx.value >= ethers.parseEther(expectedAmount.toString())
            ) {
                verified = true;
            }
        }

        // --------------------------------------------------
        // 6. Confirmation Check
        // --------------------------------------------------
        const confirmations =
            (await provider.getBlockNumber()) - receipt.blockNumber;

        if (confirmations < CONFIRMATIONS_REQUIRED) {
            return res.status(402).json({
                verified: false,
                error: "AWAITING_CONFIRMATIONS",
                confirmations,
                required: CONFIRMATIONS_REQUIRED
            });
        }

        if (!verified) {
            return res.status(402).json({
                verified: false,
                error: "VERIFICATION_FAILED"
            });
        }

        // --------------------------------------------------
        // 7. Persist Transaction
        // --------------------------------------------------
        await Transaction.create({
            txHash: paymentProof,
            merchantId,
            payer,
            amount: expectedAmount,
            currency,
            path: cleanPath,
            method: cleanMethod
        });

        return res.status(200).json({
            verified: true,
            txHash: paymentProof,
            payer,
            confirmations
        });

    } catch (error: any) {
        console.error("[FACILITATOR_CRITICAL_ERROR]", error);
        return res.status(500).json({
            error: "FACILITATOR_FAULT",
            message: "Blockchain verification failed"
        });
    }
});

export default router;
