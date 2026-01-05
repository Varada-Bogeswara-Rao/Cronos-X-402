import { ethers, network } from "hardhat";
import readline from 'readline';

const WCRO = "0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23";
const USDC = "0xc21223249ca28397b4b6541dffaecc539bff0c59";
const WHALE = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e"; // Tectonic Vault

async function main() {
    console.log("🚀 Setting up Real Simulation Environment (Fork)...");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question("👉 Enter TARGET WALLET ADDRESS to fund (Frontend Connected Wallet): ", async (targetAddress) => {
            targetAddress = targetAddress.trim();
            if (!ethers.isAddress(targetAddress)) {
                console.error("❌ Invalid Address!");
                process.exit(1);
            }

            console.log(`🎯 Targeting: ${targetAddress}`);

            // 1. Fund with CRO (Gas)
            console.log("💰 Sending 1000 CRO (Gas)...");
            await network.provider.send("hardhat_setBalance", [
                targetAddress,
                "0x3635C9ADC5DEA00000", // 1000 CRO
            ]);

            // 2. Fund with USDC (Whale Impersonation)
            console.log(`🐋 Impersonating Whale: ${WHALE}...`);
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [WHALE],
            });

            // Give whale gas (1000 ETH to be safe)
            await network.provider.send("hardhat_setBalance", [
                WHALE,
                "0x3635C9ADC5DEA00000",
            ]);

            const whaleSigner = await ethers.getSigner(WHALE);
            const usdcContract = await ethers.getContractAt("IERC20", USDC) as any;

            console.log(`💸 Transferring 10000 USDC to ${targetAddress}...`);
            const amount = ethers.parseUnits("10000", 6);

            // Allow failure if whale runs out, but Tectonic Vault has millions
            const tx = await usdcContract.connect(whaleSigner).transfer(targetAddress, amount);
            await tx.wait();

            console.log(`✅ Funding Injected.`);
            console.log("------------------------------------------------");
            console.log("ℹ️  Backend `WalletWatcher` should pick this up automatically.");
            console.log("ℹ️  Frontend Dashboard should show Real Balances.");

            resolve(undefined);
            process.exit(0);
        });
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
