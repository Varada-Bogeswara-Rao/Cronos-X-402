import "dotenv/config";
import { ethers } from "ethers";
import { AgentError } from "../errors";
import { PaymentExecutor } from "./executors";
import { PaymentRequest, WalletContext } from "./types";

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
];

const CONFIRMATIONS = 1;        // safe for Cronos testnet
const TX_TIMEOUT_MS = 60_000;   // 60s timeout

export class CronosUsdcExecutor implements PaymentExecutor {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private usdc: ethers.Contract;
    private chainId!: number;

    constructor(
        rpcUrl: string,
        privateKey: string,
        usdcAddress: string,
        expectedChainId?: number
    ) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        const signingKey = new ethers.SigningKey(privateKey);
        this.wallet = new ethers.Wallet(signingKey, this.provider);

        this.usdc = new ethers.Contract(usdcAddress, ERC20_ABI, this.wallet);

        // Optional but recommended
        if (expectedChainId) {
            this.verifyChain(expectedChainId);
        }
    }

    // ---------------- SAFETY ----------------

    private async verifyChain(expectedChainId: number) {
        const network = await this.provider.getNetwork();
        this.chainId = Number(network.chainId);

        if (this.chainId !== expectedChainId) {
            throw new Error(
                `ChainId mismatch: expected ${expectedChainId}, got ${this.chainId} `
            );
        }

        console.log(`[CRONOS] Connected to chainId ${this.chainId} `);
    }

    // ---------------- EXECUTION ----------------

    private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
        let lastError: any;
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (e: any) {
                lastError = e;
                // Don't retry revert errors
                if (e.code === 'CALL_EXCEPTION' || e.code === 'INSUFFICIENT_FUNDS') throw e;
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
            }
        }
        throw lastError;
    }

    async execute(request: PaymentRequest): Promise<string> {
        // 0. Connection Check
        if (!this.chainId) await this.verifyChain(Number(request.chainId));

        console.log(
            `[CRONOS] Paying ${request.amount} ${request.currency} -> ${request.payTo}
merchant = ${request.merchantId}
route = ${request.route}
nonce = ${request.nonce}`
        );

        // --- PATH A: Native CRO Payment ---
        if (request.currency === "CRO" || request.currency === "TCRO") {
            const amount = ethers.parseEther(request.amount.toString());

            // 1. Balance Check
            const balance = await this.withRetry(() => this.provider.getBalance(this.wallet.address));
            const MIN_GAS = ethers.parseEther("0.05"); // Reserve gas
            if (balance < (amount + MIN_GAS)) {
                throw new Error(
                    `Insufficient CRO balance: have ${ethers.formatEther(balance)}, need ${request.amount} + gas`
                );
            }

            // 2. Send Tx
            const txHandler = await this.withRetry(() => this.wallet.sendTransaction({
                to: request.payTo,
                value: amount
            }));

            console.log(`[CRONOS] CRO Tx sent: ${txHandler.hash}. Waiting for confirmation...`);

            // 3. Wait
            const receipt = await Promise.race([
                this.withRetry(() => txHandler.wait(CONFIRMATIONS)),
                new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error("Transaction confirmation timeout")), TX_TIMEOUT_MS)
                ),
            ]) as ethers.TransactionReceipt | null;

            if (!receipt || receipt.status !== 1) throw new Error("CRO transfer failed");

            console.log(`[CRONOS] Payment confirmed: ${receipt.hash}`);
            return receipt.hash;
        }

        // --- PATH B: USDC Payment (Legacy) ---
        const amount = ethers.parseUnits(request.amount.toString(), 6); // USDC decimals

        // 1. Balance check (Retryable)
        const balance = await this.withRetry(() => this.usdc.balanceOf(this.wallet.address));
        if (balance < amount) {
            throw new Error(
                `Insufficient USDC balance: have ${ethers.formatUnits(balance, 6)}, need ${request.amount}`
            );
        }

        // 1.5 Gas Check (CRO Balance)
        const croBalance = await this.withRetry(() => this.provider.getBalance(this.wallet.address));
        const MIN_GAS = ethers.parseEther("0.1");
        if (croBalance < MIN_GAS) {
            throw new AgentError(
                `Insufficient CRO for gas: have ${ethers.formatEther(croBalance)}, need > 0.1`,
                "INSUFFICIENT_FUNDS"
            );
        }

        // 2. Send tx
        const tx = await this.withRetry(() => this.usdc.transfer(request.payTo, amount));

        console.log(`[CRONOS] Tx sent: ${tx.hash}. Waiting for confirmation...`);

        // 3. Wait
        const receipt = await Promise.race([
            this.withRetry(() => tx.wait(CONFIRMATIONS)),
            new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error("Transaction confirmation timeout")), TX_TIMEOUT_MS)
            ),
        ]) as ethers.TransactionReceipt | null;

        if (!receipt || receipt.status !== 1) {
            throw new Error("USDC transfer failed (Reverted)");
        }

        console.log(`[CRONOS] Payment confirmed: ${receipt.hash}`);

        return receipt.hash;
    }

    public getAddress(): string {
        return this.wallet.address;
    }

    public getProvider(): ethers.JsonRpcProvider {
        return this.provider;
    }

    public getSigner(): ethers.Wallet {
        return this.wallet;
    }
}
