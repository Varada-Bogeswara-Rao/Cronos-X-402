import { ethers } from "ethers";
import { YieldExecutor } from "./YieldExecutor";
import fs from "fs";
import path from "path";

/**
 * PRODUCTION CONSTANTS - Cronos Mainnet
 * Validated against Cronos Explorer & Tectonic Docs
 */
const CRONOS_CHAIN_ID = 25;
const T_USDC_ADDRESS = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
const USDC_ADDRESS = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59";

// Strict Decimals: tUSDC=8, USDC=6
const DECIMALS_T_TOKEN = 8n;
const DECIMALS_UNDERLYING = 6n;
const MANTISSA_1E18 = 10n ** 18n;

// Sanity Thresolds for Exchange Rate (Roughly 0.001 to 1.0)
// If Rate < 1e14 (0.0001) or > 1.5e18 (1.5), something is wrong.
const RATE_SANITY_MIN = 10n ** 14n;
const RATE_SANITY_MAX = (10n ** 18n) * 3n / 2n;

const ABIS = {
    T_TOKEN: [
        "function balanceOf(address owner) view returns (uint256)",
        "function exchangeRateStored() view returns (uint256)",
        "function exchangeRateCurrent() returns (uint256)", // State-changing, used via staticCall
        "function supplyRatePerBlock() view returns (uint256)",
        "function mint(uint256 mintAmount) returns (uint256)",
        "function redeem(uint256 redeemTokens) returns (uint256)",
        "function redeemUnderlying(uint256 redeemAmount) returns (uint256)",
        "function decimals() view returns (uint8)",
        "function underlying() view returns (address)"
    ],
    ERC20: [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ]
};

const STATE_FILE = path.join(process.cwd(), "share", "tectonic_position.json");

interface PositionState {
    principal: string; // BigInt stored as string
    lastUpdated: number;
}

export class TectonicExecutor implements YieldExecutor {
    protected tToken: ethers.Contract;
    protected usdc: ethers.Contract;
    private checksDone: boolean = false;

    constructor(
        protected readonly provider: ethers.JsonRpcProvider,
        protected readonly wallet: ethers.Wallet,
        public readonly tTokenAddress: string = T_USDC_ADDRESS
    ) {
        // We verify the address string matches expectation if defaults are used
        if (tTokenAddress.toLowerCase() === T_USDC_ADDRESS.toLowerCase()) {
            // Good
        } else {
            console.warn(`[TectonicExecutor] WARNING: Using non-standard tUSDC address: ${tTokenAddress}`);
        }

        this.tToken = new ethers.Contract(
            tTokenAddress,
            ABIS.T_TOKEN,
            provider
        ).connect(wallet) as any as ethers.Contract;

        this.usdc = new ethers.Contract(
            USDC_ADDRESS,
            ABIS.ERC20,
            provider
        ).connect(wallet) as any as ethers.Contract;
    }

    /**
     * SAFETY GUARD: Perform checks once before first execution
     */
    private async ensureChecks() {
        if (this.checksDone) return;

        console.log("[Tectonic] Verifying Environment...");

        // 1. Chain ID
        const net = await this.provider.getNetwork();
        if (Number(net.chainId) !== CRONOS_CHAIN_ID) {
            throw new Error(`[Tectonic] Wrong ChainID! Expected ${CRONOS_CHAIN_ID}, got ${net.chainId}`);
        }

        // 2. Underlying Match
        // Tectonic tToken has an 'underlying()' method
        try {
            const underlying = await this.tToken.underlying();
            if (underlying.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
                throw new Error(`[Tectonic] tToken underlying mismatch! Contract says: ${underlying}, Expected: ${USDC_ADDRESS}`);
            }
        } catch (e: any) {
            console.warn(`[Tectonic] Could not verify 'underlying()' on contract. Proceeding with caution. Error: ${e.message}`);
        }

        this.checksDone = true;
        console.log("[Tectonic] Checks Passed.");
    }

    // --- State Management (Hardened) ---

    private loadState(): PositionState {
        try {
            if (!fs.existsSync(STATE_FILE)) {
                return { principal: "0", lastUpdated: Date.now() };
            }
            const raw = fs.readFileSync(STATE_FILE, "utf-8");

            // Validate JSON
            if (!raw || raw.trim() === "") throw new Error("Empty file");

            const data = JSON.parse(raw);
            if (!data.principal || isNaN(Number(data.principal))) {
                console.warn("[Tectonic] Corrupt state file detected (bad principal). Resetting memory state to 0 safe default.");
                return { principal: "0", lastUpdated: Date.now() };
            }

            return data;
        } catch (error: any) {
            console.error(`[Tectonic] Error loading state: ${error.message}. Returning 0 state.`);
            return { principal: "0", lastUpdated: Date.now() };
        }
    }

    private saveState(state: PositionState) {
        try {
            // Atomic Write Pattern: Write to .tmp then rename
            const tempFile = `${STATE_FILE}.tmp`;
            fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
            fs.renameSync(tempFile, STATE_FILE);
        } catch (error: any) {
            console.error(`[Tectonic] CRITICAL: Failed to save state! ${error.message}`);
            // If save fails, we should alert but we can't stop the previous blockchain logic which likely already happened.
        }
    }

    // --- Core Metrics ---

    async getVaultPosition(): Promise<{
        shares: bigint;
        pricePerShare: bigint;
        underlyingValue: bigint;
        principal: bigint;
        earnedYield: bigint;
        rawDelta: bigint;
        supplyRatePerBlock: bigint;
    }> {
        await this.ensureChecks();

        // 1. Accurate Exchange Rate using staticCall (Simulate accureInterest)
        // Fallback to stored if staticCall fails (unlikely)
        let exchangeRate = 0n;
        try {
            // @ts-ignore - staticCall check
            exchangeRate = await this.tToken.exchangeRateCurrent.staticCall();
        } catch (e) {
            console.warn("[Tectonic] exchangeRateCurrent staticCall failed, falling back to stored.");
            exchangeRate = await this.tToken.exchangeRateStored();
        }

        // Sanity Check Rate
        if (exchangeRate < RATE_SANITY_MIN || exchangeRate > RATE_SANITY_MAX) {
            throw new Error(`[Tectonic] Abnormal Exchange Rate detected: ${exchangeRate}. Aborting.`);
        }

        const [balance, supplyRate] = await Promise.all([
            this.tToken.balanceOf(this.wallet.address),
            this.tToken.supplyRatePerBlock()
        ]);

        const shares = BigInt(balance);
        const rate = BigInt(exchangeRate);

        // Formula: underlying = (shares * rate) / 1e18
        // Safety check for decimals if needed, but 1e18 is standard for comp forks
        const underlyingValue = (shares * rate) / MANTISSA_1E18;

        const state = this.loadState();
        const principal = BigInt(state.principal);

        // rawDelta can be negative if market value drops (e.g. bad debt liquidation in protocol)
        const rawDelta = underlyingValue - principal;
        const earnedYield = rawDelta < 0n ? 0n : rawDelta;

        return {
            shares,
            pricePerShare: rate,
            underlyingValue,
            principal,
            earnedYield,
            rawDelta,
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
        await this.ensureChecks();

        console.log(`[Tectonic] Supplying ${ethers.formatUnits(usdcAmount, DECIMALS_UNDERLYING)} USDC...`);

        // 1. Approve
        try {
            const allowance = await this.usdc.allowance(this.wallet.address, this.tTokenAddress);
            if (BigInt(allowance) < usdcAmount) {
                console.log("   Approving USDC...");
                const txApprove = await this.usdc.approve(this.tTokenAddress, usdcAmount);
                await txApprove.wait(1);
            }
        } catch (error: any) {
            throw new Error(`[Tectonic] Approval Failed: ${error.message}`);
        }

        // 2. Mint
        let tx;
        try {
            // Mint returns uint error code in V2, but ethers treats success tx as valid.
            // If mint fails, it typically reverts in modern forks.
            tx = await this.tToken.mint(usdcAmount);
            await tx.wait(1);
            console.log("   Confirmed!");
        } catch (error: any) {
            throw new Error(`[Tectonic] Mint Failed: ${error.message}`);
        }

        // 3. Update Principal (Only after success)
        try {
            const state = this.loadState();
            state.principal = (BigInt(state.principal) + usdcAmount).toString();
            state.lastUpdated = Date.now();
            this.saveState(state);
        } catch (err) {
            console.error("   [Tectonic] Non-Critical: Failed to update local principal file.");
        }

        return tx.hash;
    }

    /**
     * Withdraws only the EARNED YIELD (Profit).
     * Keeps Principal intact.
     */
    async withdrawYield(): Promise<string> {
        await this.ensureChecks();
        const pos = await this.getVaultPosition();

        if (pos.earnedYield <= 0n) {
            console.log("No yield to withdraw.");
            return "";
        }

        console.log(`[Tectonic] Withdrawing Yield: ${ethers.formatUnits(pos.earnedYield, DECIMALS_UNDERLYING)} USDC`);

        // Safety: redeemUnderlying checks liquidity internally
        const tx = await this.tToken.redeemUnderlying(pos.earnedYield);
        console.log(`[Tectonic] Tx Sent: ${tx.hash}`);
        await tx.wait(1);

        // No principal update needed since profit is skimmed.
        // Principal remains "original cost basis".
        return tx.hash;
    }

    /**
     * Withdraws EVERYTHING.
     * Resets Principal to 0.
     */
    async withdrawAll(): Promise<string> {
        await this.ensureChecks();
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

    // INTERNAL/UNSAFE: Direct share withdrawal
    // Exposed for Interface compliance but discouraged for Agent logic
    async withdraw(amountShares: bigint): Promise<string> {
        await this.ensureChecks();
        const tx = await this.tToken.redeem(amountShares);
        await tx.wait(1);
        return tx.hash;
    }
}
