import { ethers } from "ethers";
import Merchant from "../models/Merchant";
import WalletSnapshot from "../models/WalletSnapshot";

export class WalletWatcher {
    private provider: ethers.JsonRpcProvider;
    private usdcContract: ethers.Contract;
    private tUsdcContract: ethers.Contract;

    constructor() {
        const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        // Sanity Check (Constructors can't be async, so we fire and forget or check on first call)
        this.provider.getNetwork().then(net => {
            console.log(`[WalletWatcher] Connected to chain ${net.chainId}`);
            // Note: In dev/fork this might be 31337 or 1337, production 25.
            // We log but don't crash constructor.
        }).catch(e => console.error("[WalletWatcher] Chain connection failed", e));

        const usdcAddress = process.env.USDC_CONTRACT_ADDRESS || "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
        const tUsdcAddress = process.env.TECTONIC_TUSDC_ADDRESS || "0x0000000000000000000000000000000000000000";

        const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
        const TTOKEN_ABI = [
            "function balanceOf(address) view returns (uint256)",
            "function exchangeRateStored() view returns (uint256)",
            "function exchangeRateCurrent() returns (uint256)"
        ];

        this.usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, this.provider);
        this.tUsdcContract = new ethers.Contract(tUsdcAddress, TTOKEN_ABI, this.provider);
    }

    /**
     * Snapshots ALL active merchant wallets
     */
    async snapshotAll(): Promise<void> {
        console.log("🕵️ [WalletWatcher] Snapshotting all merchants...");
        const merchants = await Merchant.find({ "status.active": true });

        // Parallel Execution
        const results = await Promise.allSettled(
            merchants.map(async (merchant) => {
                try {
                    if (merchant.wallet && merchant.wallet.address) {
                        const snap = await this.getSnapshot(merchant.wallet.address);
                        // Persist
                        await WalletSnapshot.findOneAndUpdate(
                            { merchantId: merchant.merchantId },
                            { ...snap, merchantId: merchant.merchantId }, // Upsert latest state
                            { upsert: true, new: true }
                        );
                        return `${merchant.merchantId}: OK`;
                    }
                    return `${merchant.merchantId}: No Wallet`;
                } catch (e: any) {
                    console.error(`❌ [WalletWatcher] Error for ${merchant.merchantId}:`, e.message);
                    throw e; // Propagate to show as rejected in allSettled
                }
            })
        );

        // Log Summary
        const successCount = results.filter(r => r.status === "fulfilled").length;
        console.log(`[WalletWatcher] Snapshotted ${successCount}/${merchants.length} merchants.`);
    }

    async getSnapshot(address: string): Promise<any> {
        // 1. Try staticCall for fresh rate, fallback to stored
        // 1. Try staticCall for fresh rate, fallback to stored
        const rate = await this.tUsdcContract.exchangeRateStored();

        const [algoParams, usdcParams, tParams] = await Promise.allSettled([
            this.provider.getBalance(address),
            this.usdcContract.balanceOf(address),
            this.tUsdcContract.balanceOf(address)
        ]);

        const cro = algoParams.status === "fulfilled" ? algoParams.value : 0n;
        const usdc = usdcParams.status === "fulfilled" ? usdcParams.value : 0n;
        const tUsdc = tParams.status === "fulfilled" ? tParams.value : 0n;

        console.log(`🔍 [Watcher] ${address.slice(0, 6)}... | CRO: ${ethers.formatEther(cro)} | USDC: ${ethers.formatUnits(usdc, 6)} | tUSDC: ${tUsdc}`);

        return {
            croBalance: cro.toString(),
            usdcBalance: usdc.toString(),
            tUsdcBalance: tUsdc.toString(),
            exchangeRate: rate.toString(),
            timestamp: Date.now(),
            version: 1
        };
    }
}
