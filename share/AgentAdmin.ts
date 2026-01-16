import { ethers } from "ethers";
import { AGENT_CONFIG_DEFAULTS } from "./config";

// Minimal ABIs required for setup
const POLICY_REGISTRY_ABI = [
    "function setPolicy(uint256 dailySpendLimit, uint256 maxPerTransaction, bytes32 policyHash) external",
    "function getPolicy(address agentAddress) external view returns (uint256, uint256, bytes32, bool, uint256)"
];

const MERCHANT_REGISTRY_ABI = [
    "function registerMerchant(string calldata merchantId, string calldata metadataURI) external",
    "function getMerchant(string calldata merchantId) external view returns (address, bool, string)"
];

export interface AdminConfig {
    privateKey: string;
    rpcUrl?: string; // Default to Cronos Testnet if omitted
}

export class AgentAdmin {

    /**
     * Sets the on-chain policy anchor for an agent.
     * Use this to "Seal" your local configuration.
     */
    static async setPolicy(config: AdminConfig, limits: { dailyLimit: number, maxPerTransaction: number }): Promise<string> {
        const rpc = config.rpcUrl || "https://evm-t3.cronos.org";
        const provider = new ethers.JsonRpcProvider(rpc);
        const wallet = new ethers.Wallet(config.privateKey, provider);

        const registry = new ethers.Contract(
            AGENT_CONFIG_DEFAULTS.anchors.agentPolicyRegistry,
            POLICY_REGISTRY_ABI,
            wallet
        );

        // 1. Calculate Hash (Must match AgentWallet logic)
        const policyData = {
            dailyLimit: limits.dailyLimit || 0,
            maxPerTransaction: limits.maxPerTransaction || 0
        };
        const policyHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(policyData)));

        // 2. Prepare visual limits (18 decimals for display)
        const dailyLimitFn = BigInt(Math.floor(limits.dailyLimit * 1e18));
        const maxPerTxFn = BigInt(Math.floor(limits.maxPerTransaction * 1e18));

        console.log(`[AgentAdmin] Setting Policy for ${wallet.address}...`);
        console.log(`[AgentAdmin] Hash: ${policyHash}`);

        const tx = await registry.setPolicy(dailyLimitFn, maxPerTxFn, policyHash);

        console.log(`[AgentAdmin] Tx Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`[AgentAdmin] ✅ Policy Secured.`);

        return tx.hash;
    }

    /**
     * Registers a new merchant ID on-chain.
     */
    static async registerMerchant(config: AdminConfig, merchantId: string): Promise<string> {
        const rpc = config.rpcUrl || "https://evm-t3.cronos.org";
        const provider = new ethers.JsonRpcProvider(rpc);
        const wallet = new ethers.Wallet(config.privateKey, provider);

        const registry = new ethers.Contract(
            AGENT_CONFIG_DEFAULTS.anchors.merchantRegistry,
            MERCHANT_REGISTRY_ABI,
            wallet
        );

        console.log(`[AgentAdmin] Registering Merchant '${merchantId}'...`);

        // Check exist
        const existing = await registry.getMerchant(merchantId);
        if (existing[0] !== ethers.ZeroAddress) {
            throw new Error(`Merchant '${merchantId}' is already registered to ${existing[0]}`);
        }

        const tx = await registry.registerMerchant(merchantId, "ipfs://placeholder");

        console.log(`[AgentAdmin] Tx Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`[AgentAdmin] ✅ Merchant Registered.`);

        return tx.hash;
    }
}
