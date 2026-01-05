
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ABI to just poke the interest
const CTOKEN_ABI = [
    "function accrueInterest() public returns (uint)",
    "function exchangeRateStored() view returns (uint)"
];

async function main() {
    const rpcUrl = process.env.CRONOS_RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // tUSDC Address
    const tUSDC_ADDR = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
    const IMPERSONATE_ADDR = "0xb6f018bF96e680a4E6FF3759CDCba43BA897b6Dc"; // Your wallet has CRO

    // 1. Check Rate Before
    const tUsdc = new ethers.Contract(tUSDC_ADDR, CTOKEN_ABI, provider);
    const rateBefore = await tUsdc.exchangeRateStored();
    console.log("🔍 Rate BEFORE Poke:", rateBefore.toString());

    // 2. Impersonate
    await provider.send("hardhat_impersonateAccount", [IMPERSONATE_ADDR]);

    // 3. Poke using Raw Transaction (Bypassing Signer issues)
    console.log("👉 Poking accrueInterest() (RAW)...");

    const iface = new ethers.Interface(CTOKEN_ABI);
    const data = iface.encodeFunctionData("accrueInterest", []);

    const txHash = await provider.send("eth_sendTransaction", [{
        from: IMPERSONATE_ADDR,
        to: tUSDC_ADDR,
        data: data
    }]);

    console.log("Hash:", txHash);
    await provider.waitForTransaction(txHash);

    // 4. Check Rate After
    const rateAfter = await tUsdc.exchangeRateStored();
    console.log("✅ Poked.");
    console.log("🔍 Rate AFTER Poke: ", rateAfter.toString());

    if (rateAfter > rateBefore) {
        console.log("🎉 SUCCESS: Exchange Rate Increased!");
    } else {
        console.log("⚠️  WARNING: Rate did not increase. Maybe Time didn't advance?");
    }

    await provider.send("hardhat_stopImpersonatingAccount", [IMPERSONATE_ADDR]);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
