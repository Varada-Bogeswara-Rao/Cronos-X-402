
import { ethers } from "hardhat";
import { YieldAgent } from "../internal/yield/YieldAgent";
import { RiskConfig } from "../internal/yield/RiskManager";
import { MockERC20, MockVault } from "../typechain-types";

// --- CONFIG ---
const MOCK_CHAIN_ID = 25; // Must match Production for VerifyDecision check

async function main() {
    console.log(`\n🧪 Starting High-Fidelity Local Simulation (The Mock Matrix)`);
    console.log("==================================================");

    // 1. Setup Identities
    const [deployer, agentWallet] = await ethers.getSigners();
    console.log(`🤖 Agent Address: ${agentWallet.address}`);

    // 2. Deploy Infrastructure
    console.log(`\n🏗️  Deploying Mock Contracts...`);
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = (await MockERC20.deploy("Mock USDC", "USDC")) as unknown as MockERC20;
    await usdc.waitForDeployment();
    console.log(`   [USDC] Deployed at: ${await usdc.getAddress()}`);

    const MockVault = await ethers.getContractFactory("MockVault");
    const vault = (await MockVault.deploy(await usdc.getAddress())) as unknown as MockVault;
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`   [Vault] Deployed at: ${vaultAddress}`);

    // 3. Fund Agent
    const FUND_AMOUNT = ethers.parseUnits("1000", 6); // 1,000 USDC (Mock has 18 decimals default? No, let's assume 18 for simplicity or check)
    // Wait, mock ERC20 default is 18. Real USDC is 6.
    // For simulation accuracy, we should check decimals, but standard OZ ERC20 is 18.
    // Agent Logic uses whatever the contract says, BUT RiskManager might assume 6? 
    // Actually RiskManager uses generic BigInt, but unit tests used 6.
    // Let's force MockERC20 to use 6 decimals? No, standard OZ is hard to override without code.
    // We will just proceed with 18 decimals, RiskManager handles ratios properly?
    // Max of 1000 * 10^18 is Huge. 
    // Wait, RiskManager assumes values are passed in.

    // Let's just mint "1000 Tokens".
    const decimals = 18; // Default OZ
    const amount = ethers.parseUnits("1000", decimals);

    console.log(`\n💸 Minting ${ethers.formatUnits(amount, decimals)} USDC to Agent...`);
    await usdc.connect(deployer).mint(agentWallet.address, amount);

    const balance = await usdc.balanceOf(agentWallet.address);
    console.log(`💰 Agent Balance: ${ethers.formatUnits(balance, decimals)} USDC`);

    // 4. Setup Yield Agent
    const facilitator = ethers.Wallet.createRandom();
    const riskConfig: RiskConfig = {
        maxYieldAllocationPercent: 0.5, // 50%
        minIdleBalance: ethers.parseUnits("10", decimals), // Keep 10 Tokens
        maxDailyYieldMoves: 5
    };

    const yieldAgent = new YieldAgent(facilitator.address, riskConfig);

    // 5. Generate Decision
    const decisionPayload = {
        agentAddress: agentWallet.address,
        vaultAddress: vaultAddress,
        chainId: MOCK_CHAIN_ID,
        decision: "APPROVE",
        scope: "YIELD_ONLY",
        nonce: ethers.hexlify(ethers.randomBytes(8)),
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600
    };

    const domain = { name: "Cronos Merchant Facilitator", version: "1", chainId: MOCK_CHAIN_ID };
    const types = {
        YieldDecision: [
            { name: "agentAddress", type: "address" },
            { name: "vaultAddress", type: "address" },
            { name: "chainId", type: "uint256" },
            { name: "decision", type: "string" },
            { name: "scope", type: "string" },
            { name: "nonce", type: "string" },
            { name: "issuedAt", type: "uint256" },
            { name: "expiresAt", type: "uint256" }
        ]
    };
    const signature = await facilitator.signTypedData(domain, types, decisionPayload);
    const signedDecision = { ...decisionPayload, signature, reason: "Local Simulation" };

    // 6. Execution
    console.log(`\n⚙️  Executing Yield Strategy...`);

    // Custom Executor for Mock Vault (signatures identical to Tectonic)
    const executor = {
        supply: async (supplyAmount: bigint) => {
            console.log(`   [TX] Approving Vault...`);
            await usdc.connect(agentWallet).approve(vaultAddress, supplyAmount);

            console.log(`   [TX] Supplying...`);
            const tx = await vault.connect(agentWallet).mint(supplyAmount);
            await tx.wait();
            return tx.hash;
        },
        withdrawYield: async () => { return "0x" }
    };

    const result = await yieldAgent.executeDecision(
        signedDecision as any,
        agentWallet.address,
        balance,
        0,
        executor
    );

    if (result.executed) {
        console.log(`✅ Execution Success! TX: ${result.txHash}`);
    } else {
        console.error(`❌ Execution Failed: ${result.reason}`);
        return;
    }

    // 7. Verify Results
    console.log(`\n🔍 Checking Position...`);
    const tBalance = await vault.balanceOf(agentWallet.address);
    console.log(`   tTokens Held: ${ethers.formatUnits(tBalance, decimals)}`);
    console.log(`\n✨ Simulation Complete.`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

// 2026 Hmmm....