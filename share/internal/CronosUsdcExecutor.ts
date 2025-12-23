import "dotenv/config";
import { ethers } from "ethers";
import { PaymentExecutor } from "./executors";
import { PaymentRequest } from "./types";

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
                `ChainId mismatch: expected ${expectedChainId}, got ${this.chainId}`
            );
        }

        console.log(`[CRONOS] Connected to chainId ${this.chainId}`);
    }

    // ---------------- EXECUTION ----------------

    async execute(request: PaymentRequest): Promise<string> {
        const amount = ethers.parseUnits(
            request.amount.toString(),
            6 // USDC decimals
        );

        console.log(
            `[CRONOS] Paying ${request.amount} USDC -> ${request.payTo}
       merchant=${request.merchantId}
       route=${request.route}
       nonce=${request.nonce}`
        );

        // 1. Balance check
        // Note: balanceOf returns bigint in v6
        const balance = await this.usdc.balanceOf(this.wallet.address);
        if (balance < amount) {
            throw new Error(
                `Insufficient USDC balance: have ${ethers.formatUnits(
                    balance,
                    6
                )}, need ${request.amount}`
            );
        }

        // 2. Send tx
        const tx = await this.usdc.transfer(request.payTo, amount);

        // 3. Wait with timeout + confirmations
        const receipt = await Promise.race([
            tx.wait(CONFIRMATIONS),
            new Promise<null>((_, reject) =>
                setTimeout(
                    () => reject(new Error("Transaction confirmation timeout")),
                    TX_TIMEOUT_MS
                )
            ),
        ]);

        if (!receipt || receipt.status !== 1) {
            throw new Error("USDC transfer failed");
        }

        console.log(`[CRONOS] Payment confirmed: ${receipt.hash}`);

        return receipt.hash;
    }

    public getAddress(): string {
        return this.wallet.address;
    }
}
