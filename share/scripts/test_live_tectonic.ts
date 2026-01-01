
import { ethers } from "ethers";
import dotenv from "dotenv";
import { RiskManager } from "../internal/yield/RiskManager";

dotenv.config();

// CONFIG
const RPC = "https://evm.cronos.org";
const TECTONIC_USDC = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e"; // tUSDC
const USDC_ADDRESS = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59"; // USDC

// ABIs
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];
const TTOKEN_ABI = [
    "function mint(uint256) returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function exchangeRateStored() view returns (uint256)",
    "function supplyRatePerBlock() view returns (uint256)"
];

async function main() {
    console.log("========================================");
    console.log("⚡ LIVE TECTONIC VERIFICATION ⚡");
    console.log("========================================");

    // 1. Connection
    const provider = new ethers.JsonRpcProvider(RPC);
    const net = await provider.getNetwork();
    const block = await provider.getBlockNumber();
    console.log(`✅ Connected to Chain ID: ${net.chainId} (${net.name}) | Block: ${block}`);

    // 2. Market Data (Read Only)
    const tToken = new ethers.Contract(TECTONIC_USDC, TTOKEN_ABI, provider);
    const supplyRate = await tToken.supplyRatePerBlock();

    // APY = Rate * BlocksPerYear (5,531,914)
    const blocksPerYear = 5531914n;
    const apyMantissa = BigInt(supplyRate) * blocksPerYear;
    const apy = Number(apyMantissa) / 1e16; // 1e18 -> %

    console.log(`📊 Current APY: ${apy.toFixed(2)}%`);
    console.log("----------------------------------------");

    // 3. User Wallet Setup
    const pk = process.env.AGENT_PRIVATE_KEY;
    if (!pk) {
        console.error("❌ No AGENT_PRIVATE_KEY in .env. Skipping execution.");
        console.log("   (Set this to a fresh wallet with $1 USDC + 5 CRO)");
        return;
    }

    const wallet = new ethers.Wallet(pk, provider);
    console.log(`🤖 Agent: ${wallet.address}`);

    const croBalance = await provider.getBalance(wallet.address);
    console.log(`   GAS: ${ethers.formatEther(croBalance)} CRO`);

    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    const usdcBal = await usdc.balanceOf(wallet.address);
    console.log(`   USDC: ${ethers.formatUnits(usdcBal, 6)}`);

    // 4. Safety Checks
    if (croBalance < ethers.parseEther("2.0")) {
        console.error("⚠️  Low Gas! Need at least 2.0 CRO.");
        return;
    }
    if (usdcBal < ethers.parseUnits("0.6", 6)) { // 60 cents
        console.error("⚠️  Low USDC! Need at least 0.60 USDC.");
        return;
    }

    // 5. Execution (Gated)
    const ENABLE_TX = process.env.ENABLE_LIVE_TX === "true";
    if (!ENABLE_TX) {
        console.log("\n🔒 READ-ONLY MODE. Set ENABLE_LIVE_TX=true to execute.");
        return;
    }

    console.log("\n🚀 LIVE EXECUTION ENABLED");
    console.log("   Action: Supply 0.50 USDC to Tectonic");

    // A. Approve
    const amount = ethers.parseUnits("0.5", 6);
    console.log("   [1/2] Approving...");
    const txApp = await usdc.approve(TECTONIC_USDC, amount);
    console.log(`   -> Hash: ${txApp.hash}`);
    await txApp.wait();
    console.log("   -> Approved.");

    // B. Mint
    console.log("   [2/2] Supplying...");
    const tTokenSigner = new ethers.Contract(TECTONIC_USDC, TTOKEN_ABI, wallet);
    const txMint = await tTokenSigner.mint(amount);
    console.log(`   -> Hash: ${txMint.hash}`);
    await txMint.wait();
    console.log("   -> CONFIRMED! 🎉");

    // 6. Verify Position
    const myTTokens = await tToken.balanceOf(wallet.address);
    console.log(`\n💰 New Position: ${ethers.formatUnits(myTTokens, 8)} tUSDC`);
}

main().catch(console.error);
