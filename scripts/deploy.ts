
import { ethers } from "hardhat";

async function main() {
    console.log("Starting deployment...");

    // 1. Deploy MerchantRegistry
    console.log("Deploying MerchantRegistry...");
    const MerchantRegistry = await ethers.getContractFactory("MerchantRegistry");
    const merchantRegistry = await MerchantRegistry.deploy();
    await merchantRegistry.waitForDeployment();
    console.log(`MerchantRegistry deployed to: ${await merchantRegistry.getAddress()}`);

    // 2. Deploy AgentPolicyRegistry
    console.log("Deploying AgentPolicyRegistry...");
    const AgentPolicyRegistry = await ethers.getContractFactory("AgentPolicyRegistry");
    const agentPolicyRegistry = await AgentPolicyRegistry.deploy();
    await agentPolicyRegistry.waitForDeployment();
    console.log(`AgentPolicyRegistry deployed to: ${await agentPolicyRegistry.getAddress()}`);

    // 3. Deploy PolicyVerifier
    console.log("Deploying PolicyVerifier...");
    const PolicyVerifier = await ethers.getContractFactory("PolicyVerifier");
    const policyVerifier = await PolicyVerifier.deploy();
    await policyVerifier.waitForDeployment();
    console.log(`PolicyVerifier deployed to: ${await policyVerifier.getAddress()}`);

    console.log("Deployment complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
