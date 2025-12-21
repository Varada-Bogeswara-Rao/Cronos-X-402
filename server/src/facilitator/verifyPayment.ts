import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import Transaction from "../models/Transaction";
import Merchant from "../models/Merchant";

const router = Router();

// --------------------------------------------------
// Security / Confirmation Settings
// --------------------------------------------------
const CONFIRMATIONS_REQUIRED =
  process.env.NODE_ENV === "production" ? 3 : 1;

// --------------------------------------------------
// Provider Helper
// --------------------------------------------------
const getProvider = () => {
  return new ethers.JsonRpcProvider(
    process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org",
    undefined,
    { staticNetwork: true }
  );
};

// --------------------------------------------------
// POST /api/facilitator/verify
// --------------------------------------------------
router.post("/facilitator/verify", async (req: Request, res: Response) => {
  try {
    const {
      merchantId,
      paymentProof,     // tx hash
      expectedAmount,
      currency,
      path,
      method
    } = req.body;

    // --------------------------------------------------
    // 0. Basic Validation
    // --------------------------------------------------
    if (!merchantId || !paymentProof || !expectedAmount || !currency) {
      return res.status(400).json({
        error: "INVALID_REQUEST",
        message: "Missing required verification fields"
      });
    }

    // --------------------------------------------------
    // 1. Replay Protection (DB-backed)
    // --------------------------------------------------
    const existingTx = await Transaction.findOne({
      txHash: paymentProof
    }).lean();

    if (existingTx) {
      return res.status(402).json({
        verified: false,
        error: "REPLAY_DETECTED",
        message: "Transaction already used"
      });
    }

    // --------------------------------------------------
    // 2. Fetch & Validate Merchant
    // --------------------------------------------------
    const merchant = await Merchant.findOne({ merchantId }).lean();

    if (!merchant || !merchant.status?.active) {
      return res.status(403).json({
        error: "MERCHANT_INACTIVE"
      });
    }

    const merchantAddress = merchant.wallet.address.toLowerCase();

    // --------------------------------------------------
    // 3. Fetch Transaction + Receipt
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

    // --------------------------------------------------
    // 4. Chain ID Check (anti cross-chain replay)
    // --------------------------------------------------
    const network = await provider.getNetwork();
    const expectedChainId = BigInt(process.env.CRONOS_CHAIN_ID || 338);

    if (network.chainId !== expectedChainId) {
      return res.status(402).json({
        error: "WRONG_NETWORK"
      });
    }

    // --------------------------------------------------
    // 5. Payment Verification Logic
    // --------------------------------------------------
    let verified = false;

    // ---------- ERC20 (USDC) ----------
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
        } catch {
          continue;
        }
      }
    }

    // ---------- Native CRO ----------
    if (currency === "CRO" || currency === "TCRO") {
      if (
        tx.to?.toLowerCase() === merchantAddress &&
        tx.value >= ethers.parseEther(expectedAmount.toString())
      ) {
        verified = true;
      }
    }

    // --------------------------------------------------
    // 6. Confirmation Depth Check
    // --------------------------------------------------
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    if (confirmations < CONFIRMATIONS_REQUIRED) {
      return res.status(402).json({
        verified: false,
        error: "AWAITING_CONFIRMATIONS",
        current: confirmations,
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
    // 7. Persist Transaction (Atomic)
    // --------------------------------------------------
    await Transaction.create({
      txHash: paymentProof,
      merchantId,
      payer,
      amount: expectedAmount,
      currency,
      path: path || "unknown",
      method: method || "GET"
    });

    // --------------------------------------------------
    // 8. Success
    // --------------------------------------------------
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
