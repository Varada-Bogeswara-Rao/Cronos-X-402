/**
 * --------------------------------------------------------------------------
 * TECTONIC SIMULATION & TESTING UTILITY
 * --------------------------------------------------------------------------
 * ⚠️ THIS FILE IS FOR LOCAL TESTING ONLY.
 * ⚠️ DO NOT IMPORT IN PRODUCTION CODE.
 * ⚠️ DO NOT DEPLOY.
 *
 * Capabilities:
 * - Mock Principal Tracking (Fake Deposits)
 * - Mock Wallet Balance (Fake Gains)
 * - Verify Yield Calculation Logic
 * --------------------------------------------------------------------------
 */

import "dotenv/config";
import { ethers } from "ethers";
import { TectonicExecutor } from "./internal/TectonicExecutor";
import readline from "readline";
import fs from "fs";
import path from "path";

const RPC_URL = "https://evm.cronos.org";

/**
 * MOCK EXECUTOR
 * Extends production executor to allow overriding balance/shares for testing.
 * Uses 'protected' access instead of unsafe casts.
 */
class MockTectonicExecutor extends TectonicExecutor {
    public fakeShares: bigint = 0n;
    public useFakeBalance: boolean = false;

    constructor(
        provider: ethers.JsonRpcProvider,
        wallet: ethers.Wallet
    ) {
        super(provider, wallet);
    }

    /**
     * Override getVaultPosition to inject Fake Balances
     */
    async getVaultPosition() {
        // 1. Get Real Exchange Rate & Supply Rate from Chain via staticCall (Safe)
        let exchangeRate = 0n;
        try {
            // @ts-ignore - staticCall is valid on contract method
            exchangeRate = await this.tToken.exchangeRateCurrent.staticCall();
        } catch (e) {
            console.warn("⚠️ [Mock] staticCall failed, using stored rate.");
            exchangeRate = await this.tToken.exchangeRateStored();
        }

        const supplyRate = await this.tToken.supplyRatePerBlock();
        const realBalance = await this.tToken.balanceOf(this.wallet.address);

        // 2. Decide: Real vs Mock Balance
        const shares = this.useFakeBalance ? this.fakeShares : BigInt(realBalance);

        // 3. Calculate Underlying Value
        // Tectonic/Compound: underlying = (shares * rate) / 1e18
        const rate = BigInt(exchangeRate);
        const underlyingValue = (shares * rate) / (10n ** 18n);

        // 4. Load State Safely
        const STATE_FILE = path.join(process.cwd(), "share", "tectonic_position.json");
        let principal = 0n;

        try {
            if (fs.existsSync(STATE_FILE)) {
                const raw = fs.readFileSync(STATE_FILE, "utf-8");
                if (raw.trim()) {
                    const data = JSON.parse(raw);
                    // Validate Principal is numeric
                    if (data.principal && !isNaN(Number(data.principal))) {
                        principal = BigInt(data.principal);
                    }
                }
            }
        } catch (e) {
            console.error("⚠️ [Mock] Failed to load state file. Assuming 0 principal.");
        }

        // 5. Calculate Metrics
        // rawDelta: True PnL (Can be negative)
        // earnedYield: withdrawable profit (Can't be negative)
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

    /**
     * MOCK HELPER: Sets a fake USDC balance for simulation
     */
    async setFakeUsdcBalance(usdcAmount: string) {
        // Need current rate to convert USDC -> Shares
        // @ts-ignore
        const rate = await this.tToken.exchangeRateStored();

        // Shares = (Underlying * 1e18) / Rate
        const underlyingWei = ethers.parseUnits(usdcAmount, 6);
        this.fakeShares = (underlyingWei * (10n ** 18n)) / BigInt(rate);
        this.useFakeBalance = true;
    }
}

// --- CLI Interface ---

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const loop = async (executor: MockTectonicExecutor) => {
    rl.question("\nSelect Option (1-4): ", async (answer) => {
        try {
            switch (answer.trim()) {
                case "1":
                    await viewPortfolio(executor);
                    break;
                case "2":
                    await setPrincipal();
                    break;
                case "3":
                    await setFakeBalance(executor);
                    break;
                case "4":
                    console.log("Exiting...");
                    rl.close();
                    process.exit(0);
                    break;
                default:
                    console.log("Invalid option");
            }
        } catch (e: any) {
            console.error("❌ Error:", e.message);
        }
        loop(executor); // Recursive
    });
};

async function main() {
    console.log("=========================================");
    console.log("🧪 Tectonic Strategy Operations Suite");
    console.log("   (SIMULATION MODE)");
    console.log("=========================================");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    // Safe Random Wallet (Strict Type: HDNodeWallet -> Wallet)
    const randomStats = ethers.Wallet.createRandom();
    const wallet = new ethers.Wallet(randomStats.privateKey, provider);

    const executor = new MockTectonicExecutor(provider, wallet);

    console.log(`Wallet: ${wallet.address} (RANDOM/SAFE)`);
    console.log("\nOptions:");
    console.log("1. 📊 View Portfolio (State Tracking)");
    console.log("2. ➕ Set 'Principal' (Fake Deposit)");
    console.log("3. 💰 Set 'Current Balance' (Fake Gains)");
    console.log("4. ❌ Exit");

    loop(executor);
}

// --- Interaction Handlers ---

async function viewPortfolio(executor: MockTectonicExecutor) {
    console.log("\nFetching Real-Time Protocol Data...");
    const pos = await executor.getVaultPosition();

    console.log("--------------------------------------------------");
    console.log("💼 PORTFOLIO STATE (Simulated)");
    console.log("--------------------------------------------------");
    console.log(`> Principal (Deposited based on JSON):   ${ethers.formatUnits(pos.principal, 6)} USDC`);
    console.log(`> Current Value (Simulated Balance):     ${ethers.formatUnits(pos.underlyingValue, 6)} USDC`);

    // Display rawDelta to show true performance
    console.log(`> Raw Delta (PnL):                       ${ethers.formatUnits(pos.rawDelta, 6)} USDC`);

    if (pos.earnedYield > 0n) {
        console.log(`> Withdrawable Yield:                    ${ethers.formatUnits(pos.earnedYield, 6)} USDC  ✅`);
    } else {
        console.log(`> Withdrawable Yield:                    0.0 USDC`);
    }
    console.log("--------------------------------------------------");
}

async function setPrincipal() {
    return new Promise<void>((resolve) => {
        rl.question("Enter FAKE Deposit Amount (USDC): ", (amount) => {
            if (isNaN(Number(amount)) || Number(amount) < 0) {
                console.error("❌ Invalid Amount");
                resolve();
                return;
            }

            const wei = ethers.parseUnits(amount, 6);
            const STATE_FILE = path.join(process.cwd(), "share", "tectonic_position.json");

            // Safe Atomic Write logic simulation
            const newState = {
                principal: wei.toString(),
                lastUpdated: Date.now()
            };

            try {
                fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
                console.log(`✅ Principal file updated to ${amount} USDC.`);
            } catch (e) {
                console.error("❌ Failed to write state file");
            }
            resolve();
        });
    });
}

async function setFakeBalance(executor: MockTectonicExecutor) {
    return new Promise<void>((resolve) => {
        rl.question("Enter FAKE Current Balance (USDC): ", async (amount) => {
            if (isNaN(Number(amount)) || Number(amount) < 0) {
                console.error("❌ Invalid Amount");
                resolve();
                return;
            }
            await executor.setFakeUsdcBalance(amount);
            console.log(`✅ Mock Balance updated to ${amount} USDC.`);
            resolve();
        });
    });
}

main();
