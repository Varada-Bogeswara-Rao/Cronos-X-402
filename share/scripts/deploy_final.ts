
import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Starting Final Deployment...");
    const [deployer] = await ethers.getSigners();
    console.log(`👨‍💻 Deployer: ${deployer.address}`);

    // 1. Mock USDC
    console.log("1. Deploying USDC...");
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20Factory.deploy("Mock USDC", "USDC");
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
    console.log("6. Deploying Delegator...");
    const DelegatorFactory = await ethers.getContractFactory("TErc20Delegator");
    // constructor(underlying, core, interestRateModel, initialExchangeRateMantissa, name, symbol, decimals, admin, implementation, becomeImplementationData)
    // 0.02 * 1e18 = 20000000000000000 (2e16)
    const initialRate = ethers.parseEther("0.02");
    const delegator = await DelegatorFactory.deploy(
        await usdc.getAddress(),
        coreAddress,
        irmAddress,
        initialRate,
        "Tectonic USDC",
        "tUSDC",
        8,
        deployer.address,
        delegateAddress,
        "0x" // No data for becomeImplementation
    );
    await delegator.waitForDeployment();
    console.log(`   -> tUSDC: ${await delegator.getAddress()}`);

    console.log("✅ Deployment Complete.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
