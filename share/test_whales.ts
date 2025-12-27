
import "dotenv/config";
import { ethers } from "ethers";
import { VvsYieldExecutor } from "./internal/VvsYieldExecutor";

const WHALES = [
    { addr: "0xb0F8b79a06662D6c165Bf67B4A7DE963aaf9ec50", note: "Top Tier Staker" },
    { addr: "0x34d1856ED8BBc20FA7b29776ad273FD8b22967BE", note: "High Value DeFi Wallet" },
    { addr: "0x207ed449a0972c3971936998656667b10a8f6f6f", note: "Large BigInt Test" }
];
const RPC_URL = "https://evm.cronos.org";

async function run() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    for (const whale of WHALES) {
        console.log(`\n🐳 Testing ${whale.addr} (${whale.note})`);
        try {
            const cleanAddress = ethers.getAddress(whale.addr.toLowerCase());

            // Mock active wallet
            const mockWallet = { address: cleanAddress } as any as ethers.Wallet;
            const executor = new VvsYieldExecutor(provider, mockWallet);

            const pos = await executor.getVaultPosition();

            console.log(`   Shares: ${ethers.formatUnits(pos.shares, 18)}`);
            console.log(`   PPS:    ${ethers.formatUnits(pos.pricePerShare, 18)}`);
            console.log(`   Value:  ${ethers.formatUnits(pos.underlyingValue, 18)} VVS`);

            if (pos.shares === 0n) {
                console.log("   ⚠️  Zero Shares found. User might not be in this specific AutoVVS Vault (0xA6fF...).");
            }

        } catch (error: any) {
            console.error("   ❌ Error:", error.message);
        }
    }
}

run();
