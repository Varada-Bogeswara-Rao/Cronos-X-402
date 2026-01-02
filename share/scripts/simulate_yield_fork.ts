
import { ethers, network } from "hardhat";
import { YieldAgent } from "../internal/yield/YieldAgent";
import { RiskConfig } from "../internal/yield/RiskManager";
import { IERC20 } from "../typechain-types";

// --- CONFIG ---
const T_USDC_ADDRESS = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
async function main() {
    const net = await ethers.provider.getNetwork();
    const CRONOS_CHAIN_ID = Number(net.chainId); // Auto-detect (31337 or 25)
    console.log(`\n🌌 Entering the Matrix (Cronos Mainnet Fork) - Chain ID: ${CRONOS_CHAIN_ID}`);

    console.log("==================================================");

    // 1. Setup Identities
    const [deployer, agentWallet] = await ethers.getSigners();
    console.log(`🤖 Agent Address: ${agentWallet.address}`);

    // 2. Locate Contracts & Whale


    // Dynamic USDC Address lookup!
    // We need an ABI that includes underlying()
    const tTokenAbi = [
        "function underlying() view returns (address)",
        "function mint(uint mintAmount) returns (uint)",
        "function balanceOf(address owner) view returns (uint)",
        "function approve(address spender, uint amount) returns (bool)"
    ];
    // Cast to any to avoid strict typing issues with ethers v6/hardhat mismatch
    const tTokenRef = new ethers.Contract(T_USDC_ADDRESS, tTokenAbi, ethers.provider) as any;
    const USDC_ADDRESS = await tTokenRef.underlying();
    console.log(`🔍 Found USDC Contract: ${USDC_ADDRESS}`);

    const usdc = (await ethers.getContractAt("IERC20", USDC_ADDRESS)) as unknown as IERC20;

    // 3. The Heist (Whale Impersonation)
    // We impersonate the Tectonic Vault itself because we KNOW it has USDC.
    const WHALE_ADDRESS = T_USDC_ADDRESS;
    console.log(`🐋 Impersonating Whale: ${WHALE_ADDRESS}`);

    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [WHALE_ADDRESS],
    });

    // ⛽ GIVE GAS TO WHALE (Essential for txs)
    await network.provider.send("hardhat_setBalance", [
        WHALE_ADDRESS,
        "0xDE0B6B3A7640000", // 1 ETH (plenty of gas)
    ]);

    const whale = await ethers.getSigner(WHALE_ADDRESS);

    // 4. Funding the Agent
    const FUND_AMOUNT = ethers.parseUnits("1000", 6); // 1,000 USDC
    console.log(`💸 Transferring ${ethers.formatUnits(FUND_AMOUNT, 6)} USDC to Agent...`);

    // We must act as the whale
    await usdc.connect(whale).transfer(agentWallet.address, FUND_AMOUNT);

    const balance = await usdc.balanceOf(agentWallet.address);
    console.log(`💰 Agent Balance: ${ethers.formatUnits(balance, 6)} USDC`);

    // 5. Setup Yield System
    // We need a Facilitator to sign the decision.
    const facilitator = ethers.Wallet.createRandom(); // Local random is fine for simulation

    // Configure Agent
    const riskConfig: RiskConfig = {
        maxYieldAllocationPercent: 0.5, // 50%
        minIdleBalance: ethers.parseUnits("10", 6), // Keep $10
        maxDailyYieldMoves: 5
    };

    const yieldAgent = new YieldAgent(facilitator.address, riskConfig);

    // 6. Generate Decision (Brain)
    // We simulate the brain seeing the yield and signing.
    const decisionPayload = {
        agentAddress: agentWallet.address,
        vaultAddress: T_USDC_ADDRESS,
        chainId: CRONOS_CHAIN_ID,
        decision: "APPROVE",
        scope: "YIELD_ONLY",
        nonce: ethers.hexlify(ethers.randomBytes(8)),
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600
    };

    // Signing Logic (EIP-712)
    const domain = { name: "Cronos Merchant Facilitator", version: "1", chainId: CRONOS_CHAIN_ID };
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
    const signedDecision = { ...decisionPayload, signature, reason: "Matrix Simulation" };

    // 7. Execution (The Muscle)
    console.log(`\n⚙️  Executing Yield Strategy...`);

    // We need an Executor that uses the HARDHAT provider/signer
    // Quick inline executor implementation for simulation
    const executor = {
        supply: async (amount: bigint) => {
            // A. Approve
            console.log(`   [TX] Approving Tectonic...`);
            await usdc.connect(agentWallet).approve(T_USDC_ADDRESS, amount);

            // B. Mint (Supply)
            console.log(`   [TX] Supplying to Tectonic...`);
            // Note: Tectonic 'mint' returns uint (error code), 0 is success
            const tx = await tTokenRef.connect(agentWallet).mint(amount);
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

    // 8. Time Travel (Yield Farming)
    console.log(`\n⏳ Time Traveling 30 Days...`);
    // Increase time
    await network.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await network.provider.send("evm_mine"); // Mine a block to apply changes

    // 9. Validation (Profit Check)
    console.log(`\n🔍 Checking Profit...`);
    // Tectonic accrues interest by increasing the Exchange Rate (tToken -> USDC)
    // We need to check the current value of our tTokens.
    const tBalance = await tTokenRef.balanceOf(agentWallet.address);
    console.log(`   tUSDC Held: ${ethers.formatUnits(tBalance, 8)}`);

    console.log(`\n✨ Simulation Complete. The Agent successfully invested autonomous funds on Mainnet Fork.`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
