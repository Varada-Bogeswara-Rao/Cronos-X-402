import { ethers } from "ethers";
import { YieldExecutor } from "./YieldExecutor";
import fs from "fs";
import path from "path";

// Tectonic tUSDC Contract (Cronos Mainnet)
const T_USDC_ADDRESS = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
// USDC Contract (for approval)
const USDC_ADDRESS = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59";

const T_TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function exchangeRateStored() view returns (uint256)",
    "function supplyRatePerBlock() view returns (uint256)",
    "function redeem(uint256 redeemTokens) returns (uint256)",
    "function redeemUnderlying(uint256 redeemAmount) returns (uint256)",
    "function mint(uint256 mintAmount) returns (uint256)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const STATE_FILE = path.join(process.cwd(), "share", "tectonic_position.json");

interface PositionState {
    principal: string; // BigInt stored as string
    lastUpdated: number;
}

export class TectonicExecutor implements YieldExecutor {
    private tToken: ethers.Contract;
    private usdc: ethers.Contract;

    constructor(
        private readonly provider: ethers.JsonRpcProvider,
        private readonly wallet: ethers.Wallet,
        public readonly tTokenAddress: string = T_USDC_ADDRESS
    ) {
        this.tToken = new ethers.Contract(
            tTokenAddress,
            T_TOKEN_ABI,
            provider
        ).connect(wallet) as any as ethers.Contract;

        this.usdc = new ethers.Contract(
            USDC_ADDRESS,
            ERC20_ABI,
            provider
        ).connect(wallet) as any as ethers.Contract;
    }

    // --- State Management ---

    private loadState(): PositionState {
        if (!fs.existsSync(STATE_FILE)) {
            return { principal: "0", lastUpdated: Date.now() };
        }
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }

    private saveState(state: PositionState) {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }

    // --- Core Metrics ---

    async getVaultPosition(): Promise<{
        shares: bigint;
        pricePerShare: bigint;
        underlyingValue: bigint;
        principal: bigint;
        earnedYield: bigint;
        supplyRatePerBlock: bigint;
    }> {
        const [balance, exchangeRate, supplyRate] = await Promise.all([
            this.tToken.balanceOf(this.wallet.address),
            this.tToken.exchangeRateStored(),
            this.tToken.supplyRatePerBlock()
        ]);

        const shares = BigInt(balance);
        const rate = BigInt(exchangeRate);
        const underlyingValue = (shares * rate) / 10n ** 18n;

        const state = this.loadState();
        const principal = BigInt(state.principal);

        // Yield = Current Value - Principal
        // If Value < Principal (unlikely in lending unless bad debt), yield is 0 (or negative)
        let earnedYield = underlyingValue - principal;
        if (earnedYield < 0n) earnedYield = 0n;

        return {
            shares,
            pricePerShare: rate,
            underlyingValue,
            principal,
            earnedYield,
            supplyRatePerBlock: BigInt(supplyRate)
        };
    }

    async harvest(): Promise<number> {
        return 0; // Auto-compounding
    }

    // --- Actions ---

    /**
     * Supplies USDC and updates Principal
     */
    async supply(usdcAmount: bigint): Promise<string> {
        console.log(`[Tectonic] Supplying ${ethers.formatUnits(usdcAmount, 6)} USDC...`);

        // 1. Approve
        const allowance = await this.usdc.allowance(this.wallet.address, this.tTokenAddress);
        if (BigInt(allowance) < usdcAmount) {
            console.log("   Approving USDC...");
            const txApprove = await this.usdc.approve(this.tTokenAddress, usdcAmount);
            await txApprove.wait(1);
        }

        // 2. Mint
        const tx = await this.tToken.mint(usdcAmount);
        await tx.wait(1);
        console.log("   Confirmed!");

        // 3. Update Principal
        const state = this.loadState();
        state.principal = (BigInt(state.principal) + usdcAmount).toString();
        state.lastUpdated = Date.now();
        this.saveState(state);

        return tx.hash;
    }

    /**
     * Withdraws only the EARNED YIELD (Profit).
     * Keeps Principal intact (mostly).
     */
    async withdrawYield(): Promise<string> {
        const pos = await this.getVaultPosition();
        if (pos.earnedYield <= 0n) {
            console.log("No yield to withdraw.");
            return "";
        }

        console.log(`[Tectonic] Withdrawing Yield: ${ethers.formatUnits(pos.earnedYield, 6)} USDC`);

        // We use redeemUnderlying logic for precision, but Tectonic usually expects redeem() in shares 
        // or redeemUnderlying() for exact amount.
        // redeemUnderlying is cleaner for "I want 5 USDC".

        // Note: redeeming underlying decreases your balance. 
        // Since we are "skimming" yield, our Principal "dollar value" technically remains the same?
        // Wait: If I have 100 USDC Principal. It grows to 105 USDC.
        // I remove 5 USDC. My balance is now 100 USDC.
        // My Principal is still 100 USDC (originally deposited).
        // So I do NOT update principal in state.

        const tx = await this.tToken.redeemUnderlying(pos.earnedYield);
        console.log(`[Tectonic] Tx Sent: ${tx.hash}`);
        await tx.wait(1);

        return tx.hash;
    }

    /**
     * Withdraws EVERYTHING.
     * Resets Principal to 0.
     */
    async withdrawAll(): Promise<string> {
        // To withdraw all, we check our share balance and redeem() that specific share amount.
        // Using redeemUnderlying for "all" is risky due to tiny interest accruing between check and tx.
        const shares = await this.tToken.balanceOf(this.wallet.address);

        if (BigInt(shares) === 0n) {
            console.log("Nothing to withdraw.");
            return "";
        }

        console.log(`[Tectonic] Withdrawing ALL (Redeeming ${shares} shares)...`);
        const tx = await this.tToken.redeem(shares);
        console.log(`[Tectonic] Tx Sent: ${tx.hash}`);
        await tx.wait(1);

        // Reset Principal
        this.saveState({ principal: "0", lastUpdated: Date.now() });

        return tx.hash;
    }

    // Standard Interface method (defaults to simple redeem shares)
    async withdraw(amountShares: bigint): Promise<string> {
        return (await this.tToken.redeem(amountShares)).hash;
    }
}
