
import "dotenv/config";
import { ethers } from "ethers";

const CRAFTSMAN_V2 = "0x3ED7c8052062402130C3238914A6c922C0A5F9d7";
const RPC_URL = "https://evm.cronos.org";

const ABI = [
    "function poolLength() view returns (uint256)",
    "function poolInfo(uint256) view returns (uint256 allocPoint, uint256 lastRewardBlock, uint256 accVvsPerShare)",
    "function lpToken(uint256) view returns (address)",
    "function pendingVVS(uint256, address) view returns (uint256)",
    "function pendingReward(uint256, address) view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const validAddr = ethers.getAddress(CRAFTSMAN_V2.toLowerCase());

    console.log(`Checking Code for V2: ${validAddr}`);
    const code = await provider.getCode(validAddr);
    console.log(`Code Length: ${code.length}`);

    if (code === "0x") return;

    const mk = new ethers.Contract(validAddr, ABI, provider);

    try {
        const len = await mk.poolLength();
        console.log(`✅ poolLength: ${len}`);
    } catch (e: any) {
        console.log("❌ poolLength failed");
    }

    try {
        const lp = await mk.lpToken(0);
        console.log(`✅ lpToken(0): ${lp}`);
    } catch (e: any) {
        // console.log("❌ lpToken(0) failed");
    }

    try {
        const pi = await mk.poolInfo(0);
        console.log(`✅ poolInfo(0): alloc=${pi.allocPoint}`);
    } catch (e: any) {
        console.log("❌ poolInfo(0) failed");
    }
}

main().catch(console.error);
