import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import crypto from "crypto";
import { z } from "zod";
import Transaction from "../models/Transaction";
import Merchant from "../models/Merchant";
import ReplayKey from "../models/ReplayKey";
import MerchantStats from "../models/MerchantStats";
import { withRpcRetry } from "../utils/rpcRetry";
import logger from "../utils/logger";

const router = Router();

const VerifySchema = z.object({
    paymentProof: z.string().length(66).startsWith('0x'),
    expectedAmount: z.string().regex(/^\d+(\.\d+)?$/),
    currency: z.enum(['USDC', 'CRO']),
    path: z.string().startsWith('/'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    nonce: z.string().min(6).optional()
});

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

router.post("/verify", async (req: Request, res: Response) => {
    try {
        const merchantId = req.headers["x-merchant-id"] as string;

        // [VALIDATION] Zod Schema Check (P2)
        let validatedBody;
        try {
            validatedBody = VerifySchema.parse({ ...req.body, nonce: req.headers['x-nonce'] || req.body.nonce });
        } catch (e) {
            if (e instanceof z.ZodError) {
                return res.status(400).json({ error: "VALIDATION_FAILED", details: e.errors });
            }
            throw e;
        }

        const {
            paymentProof,
            expectedAmount,
            currency,
            path,
            method
        } = validatedBody;

        if (!merchantId) {
            return res.status(400).json({ error: "MISSING_MERCHANT_ID" });
        }

        const cleanPath = canonicalPath(path);
        const cleanMethod = method.toUpperCase();

        logger.info({
            merchantId,
            cleanMethod,
            cleanPath,
            currency,
            expectedAmount
        }, "[FACILITATOR] Verify Request");

        // --------------------------------------------------
        // 1. Replay Protection (P0 Critical)
        // --------------------------------------------------
        const nonce = req.headers["x-nonce"] || req.body.nonce;
        if (!nonce) return res.status(400).json({ error: "MISSING_NONCE" });

        // Deterministic Key: merchantId + method + path + nonce
        const keyString = `${merchantId}:${cleanMethod}:${cleanPath}:${nonce}`;
        const keyHash = crypto.createHash('sha256').update(keyString).digest('hex');

        try {
            await ReplayKey.create({ keyHash, txHash: paymentProof });
        } catch (e: any) {
            if (e.code === 11000) {
                return res.status(402).json({
                    verified: false,
                    error: "REPLAY_DETECTED",
                    message: "Nonce already used for this route"
                });
            }
            throw e;
        }

        // Also check if txHash was used for a DIFFERENT purpose (Basic Double Spend)
        const globalTxReuse = await Transaction.exists({ txHash: paymentProof });
        if (globalTxReuse) {
            return res.status(402).json({
                verified: false,
                error: "TX_REUSED",
                message: "Transaction hash already processed"
            });
        }

        // --------------------------------------------------
        // 2. Fetch Merchant
        // --------------------------------------------------
        const merchant = await Merchant.findOne({ merchantId }).lean();
        if (!merchant) return res.status(404).json({ error: "MERCHANT_NOT_FOUND" });

        if (!merchant.status?.active) {
            return res.status(403).json({
                error: "MERCHANT_SUSPENDED",
                message: "This merchant account is not active."
            });
        }

        // --------------------------------------------------
        // 3. 🔥 ROUTE REGISTRATION CHECK
        // --------------------------------------------------
        const route = merchant.api?.routes?.find(
            (r: any) =>
                r.method === cleanMethod &&
                canonicalPath(r.path) === cleanPath
        );

        if (!route) {
            console.error("[FACILITATOR] ROUTE_NOT_REGISTERED", { cleanMethod, cleanPath });
            return res.status(404).json({
                error: "ROUTE_NOT_REGISTERED",
                message: "This path is not monetized by the merchant."
            });
        }

        if (route.active === false) {
            return res.status(410).json({
                error: "ROUTE_DISABLED",
                message: "This premium route has been disabled."
            });
        }

        // --------------------------------------------------
        // 4. Chain Verification
        // --------------------------------------------------
        // --------------------------------------------------
        // 4. Chain Verification (P1 Reliability)
        // --------------------------------------------------
        const provider = getProvider();

        // [RELIABILITY] Retry RPC calls
        const receipt = await withRpcRetry(() => provider.getTransactionReceipt(paymentProof));

        if (!receipt || receipt.status !== 1) {
            return res.status(402).json({
                verified: false,
                error: "TX_NOT_FOUND_OR_FAILED"
            });
        }

        const tx = await withRpcRetry(() => provider.getTransaction(paymentProof));
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
        // --------------------------------------------------
        // 7. Persist Transaction & Analytics
        // --------------------------------------------------

        // Payer MUST be derived from chain (tx.from or log), never headers.
        // We already have `payer` variable derived from `tx.from` above.

        await Transaction.create({
            txHash: paymentProof,
            merchantId,
            payer,
            amount: expectedAmount,
            currency,
            path: cleanPath,
            method: cleanMethod
        });

        // [PERFORMANCE] Incremental Analytics (P1)
        await MerchantStats.updateOne(
            { merchantId },
            {
                $inc: {
                    [`totalRevenue.${currency}`]: Number(expectedAmount),
                    totalRequests: 1
                },
                $set: { lastActive: new Date() }
            },
            { upsert: true }
        );

        return res.status(200).json({
            verified: true,
            txHash: paymentProof,
            payer,
            confirmations,
            // [OPTIONAL] Return receipt ID if needed
        });

    } catch (error: any) {
        logger.error({ err: error.message, stack: error.stack }, "[FACILITATOR_CRITICAL_ERROR]");
        return res.status(500).json({
            error: "FACILITATOR_FAULT",
            message: "Blockchain verification failed"
        });
    }
});

export default router;
