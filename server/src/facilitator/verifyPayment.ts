import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { Transaction } from "../models/Transaction";
import Merchant from "../models/Merchant";

const router = Router();

// ---- Enhanced Security Constants ----
const CONFIRMATIONS_REQUIRED = process.env.NODE_ENV === 'production' ? 3 : 1;

/**
 * Helper to get the correct provider with fallback support
 */
const getProvider = () => {
    return new ethers.JsonRpcProvider(
        process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org",
        undefined,
        { staticNetwork: true } // Optimization: avoids extra net_version calls
    );
};

router.post("/facilitator/verify", async (req: Request, res: Response) => {
    try {
        const {
            merchantId,
            paymentProof,
            expectedAmount,
            currency,
            expectedPayer,
            path,
            method
        } = req.body;

        // ----------------------------
        // 1. Replay Protection (DB-backed)
        // ----------------------------
        // We check the 'Transaction' collection instead of an in-memory Set
        const existingTx = await Transaction.findOne({ txHash: paymentProof }).lean();
        if (existingTx) {
            return res.status(402).json({
                verified: false,
                error: "REPLAY_DETECTED",
                message: "This transaction hash has already been used for a payment."
            });
        }

        // ----------------------------
        // 2. Fetch & Validate Merchant
        // ----------------------------
        const merchant = await Merchant.findOne({ merchantId }).lean();
        if (!merchant || !merchant.status?.active) {
            return res.status(403).json({ error: "MERCHANT_INACTIVE" });
        }

        const merchantAddress = merchant.wallet.address.toLowerCase();

        // ----------------------------
        // 3. Chain Verification
        // ----------------------------
        const provider = getProvider();
        const receipt = await provider.getTransactionReceipt(paymentProof);

        if (!receipt || receipt.status !== 1) {
            return res.status(402).json({ verified: false, error: "TX_NOT_FOUND_OR_FAILED" });
        }

        // Check Chain ID to prevent cross-chain replay
        const network = await provider.getNetwork();
        const expectedChainId = BigInt(process.env.CRONOS_CHAIN_ID || 338);
        if (network.chainId !== expectedChainId) {
            return res.status(402).json({ error: "WRONG_NETWORK" });
        }

        // ----------------------------
        // 4. Verification Logic (Token & Native)
        // ----------------------------
        let verified = false;
        let confirmations = 0;

        if (currency === "USDC") {
            const usdcAddress = (process.env.USDC_CONTRACT_ADDRESS || "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0").toLowerCase();
            const expectedRawAmount = ethers.parseUnits(expectedAmount.toString(), 6);
            
            const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

            for (const log of receipt.logs) {
                if (log.address.toLowerCase() === usdcAddress) {
                    try {
                        const parsed = iface.parseLog(log);
                        if (parsed && 
                            parsed.args[0].toLowerCase() === expectedPayer.toLowerCase() &&
                            parsed.args[1].toLowerCase() === merchantAddress &&
                            parsed.args[2] >= expectedRawAmount) {
                            verified = true;
                            break;
                        }
                    } catch (e) { continue; }
                }
            }
        } else if (currency === "TCRO" || currency === "CRO") {
            const tx = await provider.getTransaction(paymentProof);
            if (tx && tx.from.toLowerCase() === expectedPayer.toLowerCase() && 
                tx.to?.toLowerCase() === merchantAddress) {
                if (tx.value >= ethers.parseEther(expectedAmount.toString())) {
                    verified = true;
                }
            }
        }

        // Final Confirmations Check
        const currentBlock = await provider.getBlockNumber();
        confirmations = currentBlock - receipt.blockNumber;
        if (confirmations < CONFIRMATIONS_REQUIRED) {
            return res.status(402).json({ 
                verified: false, 
                error: "AWAITING_CONFIRMATIONS",
                current: confirmations,
                required: CONFIRMATIONS_REQUIRED
            });
        }

        if (!verified) {
            return res.status(402).json({ verified: false, error: "VERIFICATION_FAILED" });
        }

        // ----------------------------
        // 5. Atomic Success: Save Sale
        // ----------------------------
        await Transaction.create({
            txHash: paymentProof,
            merchantId,
            payer: expectedPayer,
            amount: expectedAmount,
            currency,
            path: path || "unknown",
            method: method || "GET"
        });

        return res.status(200).json({
            verified: true,
            confirmations,
            txHash: paymentProof
        });

    } catch (error: any) {
        console.error("[FACILITATOR_CRITICAL_ERROR]", error.message);
        return res.status(500).json({ error: "FACILITATOR_FAULT", message: "Blockchain communication failed." });
    }
});

export default router;