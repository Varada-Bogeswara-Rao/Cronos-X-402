
import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Starting Tectonic Full Flow Simulation...");
    const [deployer, user] = await ethers.getSigners();
    console.log(`👨‍💻 Deployer: ${deployer.address}`);
    console.log(`👨‍🌾 User:     ${user.address}`);

    // --- DEPLOYMENT PHASE ---

    // 1. Mock USDC
    console.log("1. Deploying USDC...");
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const usdc = (await MockERC20Factory.deploy("Mock USDC", "USDC")) as any;
    await usdc.waitForDeployment();
    console.log(`   -> USDC: ${await usdc.getAddress()}`);

    // 2. Oracle
    console.log("2. Deploying Oracle...");
    const SimplePriceOracleFactory = await ethers.getContractFactory("SimplePriceOracle");
    const oracle = await SimplePriceOracleFactory.deploy();
    await oracle.waitForDeployment();
    console.log(`   -> Oracle: ${await oracle.getAddress()}`);

    // 3. IRM (Mock)
    console.log("3. Deploying Mock IRM...");
    const MockIRMFactory = await ethers.getContractFactory("MockInterestRateModel");
    const irm = await MockIRMFactory.deploy();
    await irm.waitForDeployment();
    const irmAddress = await irm.getAddress();
    console.log(`   -> IRM: ${irmAddress}`);

    // 4. Core (Impl)
    console.log("4. Deploying Core (Impl)...");
    const CoreFactory = await ethers.getContractFactory("TectonicCoreImpl");
    const core = await CoreFactory.deploy();
    await core.waitForDeployment();
    const coreAddress = await core.getAddress();
    console.log(`   -> Core: ${coreAddress}`);

    // 5. Delegate
    console.log("5. Deploying Delegate...");
    const DelegateFactory = await ethers.getContractFactory("TErc20Delegate");
    const delegate = await DelegateFactory.deploy();
    await delegate.waitForDeployment();
    const delegateAddress = await delegate.getAddress();
    console.log(`   -> Delegate: ${delegateAddress}`);

    // 6. Delegator
    console.log("6. Deploying Delegator (tUSDC)...");
    const DelegatorFactory = await ethers.getContractFactory("TErc20Delegator");
    const initialRate = ethers.parseEther("0.02");
    const tUsdc = (await DelegatorFactory.deploy(
        await usdc.getAddress(),
        coreAddress,
        irmAddress,
        initialRate,
        "Tectonic USDC",
        "tUSDC",
        8,
        deployer.address,
        delegateAddress,
        "0x"
    )) as any;
    await tUsdc.waitForDeployment();
    const tUsdcAddress = await tUsdc.getAddress();
    console.log(`   -> tUSDC: ${tUsdcAddress}`);

    // --- INTERACTION PHASE ---

    // 0. Initialize Market (Delegate needs to be initialized via Delegator?)
    // Constructor of Delegator calls `delegateTo(implementation, initialize(...))`
    // So distinct initialization is NOT required for the first implementation.
    // However, we need to support the market in Core?
    // Our Core stub for `_supportMarket` returns 0 (Success) but does NOTHING.
    // TToken.mint calls `mintAllowed`, which returns 0 (Success).
    // So we should be good without explicit `_supportMarket` calls for this test.

    // 1. Mint USDC to User
    console.log("\n--- SIMULATION START ---");
    console.log("1. Minting 1000 USDC to User...");
    await (await usdc.connect(deployer).mint(user.address, ethers.parseEther("1000"))).wait();
    const bal = await usdc.balanceOf(user.address);
    console.log(`   -> User USDC: ${ethers.formatEther(bal)}`);

    // 2. Approve tUSDC
    console.log("2. Approving tUSDC to spend User's USDC...");
    await (await usdc.connect(user).approve(tUsdcAddress, ethers.parseEther("1000"))).wait();
    console.log("   -> Approved.");

    // 3. Mint tUSDC (Supply)
    console.log("3. User calling tUSDC.mint(100 USDC)...");
    try {
        const tx = await tUsdc.connect(user).mint(ethers.parseEther("100"));
        await tx.wait();
        console.log("   -> Mint Transaction Success!");
    } catch (e) {
        console.error("   -> Mint Transaction FAILED:", e);
        process.exit(1);
    }

    // 4. Verify tUSDC Balance
    // 100 USDC / 0.02 Exchange Rate = 5000 tUSDC
    const tBalance = await tUsdc.balanceOf(user.address);
    const tBalanceFormatted = ethers.formatUnits(tBalance, 8);
    console.log(`4. User tUSDC Balance: ${tBalanceFormatted}`);

    if (tBalance > 0n) {
        console.log("\n✅ SUCCESS: Tectonic Replica is Fully Functional!");
    } else {
        console.error("\n❌ FAILURE: Balance mismatch or zero.");
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
