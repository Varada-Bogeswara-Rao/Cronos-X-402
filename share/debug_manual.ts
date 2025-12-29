
import "dotenv/config";
import { ethers } from "ethers";

const CRAFTSMAN_ADDR = "0xDccd6455AE04b03d785F12196B492b18129564bc"; // Correct Craftsman
const WHALE_ADDR = "0xA6fF77fC8E839679D4F7408E8988B564dE1A2dcD"; // Monitor the Vault itself!
const RPC_URL = "https://evm.cronos.org";

const ABI = [
    "function poolLength() view returns (uint256)",
    "function userInfo(uint256, address) view returns (uint256 amount, uint256 rewardDebt)",
    "function pendingVVS(uint256, address) view returns (uint256)",
    "function poolInfo(uint256) view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accVvsPerShare)"
];

const VVS_TOKEN = "0x2D03bECE6747ADC00E1a131BBA1469C15fD11e03".toLowerCase();

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const validAddr = ethers.getAddress(CRAFTSMAN_ADDR);

    // We don't need whale for scanning, just provider
    const craftsman = new ethers.Contract(validAddr, ABI, provider);

    console.log(`Scanning pools on Craftsman: ${validAddr}`);

    for (let i = 0; i < 170; i++) {
        if (i % 10 === 0) console.log(`Scanning PID ${i}...`);
        try {
            const pInfo = await craftsman.poolInfo(i);
            const lpToken = pInfo.lpToken.toLowerCase();
            const alloc = pInfo.allocPoint;

            if (alloc > 0) {
                console.log(`   PID ${i}: LP ${lpToken} | Alloc: ${alloc}`);
                if (lpToken === VVS_TOKEN) {
                    console.log(`✅ MATCH VVS! PID ${i}`);
                }
            }
        } catch (e: any) {
            // console.log(`❌ PID ${i} error`);
            // ignore
        }
    }
}

main().catch(console.error);
