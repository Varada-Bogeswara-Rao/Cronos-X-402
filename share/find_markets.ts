import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL = "https://evm.cronos.org";
const T_USDC_ADDRESS = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";

const C_TOKEN_ABI = [
    "function comptroller() view returns (address)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

const COMPTROLLER_ABI = [
    "function getAllMarkets() view returns (address[])"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log("🔍 Starting Market Discovery...");

    // 1. Get Comptroller Address from tUSDC
    const tUsdc = new ethers.Contract(T_USDC_ADDRESS, C_TOKEN_ABI, provider);
    const comptrollerAddress = await tUsdc.comptroller();
    console.log(`✅ Found Comptroller: ${comptrollerAddress}`);

    // 2. Get All Markets
    const comptroller = new ethers.Contract(comptrollerAddress, COMPTROLLER_ABI, provider);
    const allMarkets: string[] = await comptroller.getAllMarkets();
    console.log(`📊 Found ${allMarkets.length} active markets.`);

    // 3. Scan for tCRO
    console.log("SCANNING MARKETS...");
    for (const marketAddr of allMarkets) {
        try {
            const market = new ethers.Contract(marketAddr, C_TOKEN_ABI, provider);
            const symbol = await market.symbol();

            // Log interesting ones
            if (symbol === "tCRO" || symbol === "tWCRO" || symbol === "tTONIC") {
                console.log(`🌟 MATCH FOUND: ${symbol} => ${marketAddr}`);
            } else {
                // process.stdout.write("."); // Progress dot
            }
        } catch (e) {
            // Ignore errors
        }
    }
    console.log("\nDone.");
}

main();
