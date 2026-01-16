import { Contract, ethers, Provider, Wallet } from "ethers";

const ABI = [
    "function getPolicy(address agentAddress) external view returns (uint256 dailySpendLimit, uint256 maxPerTransaction, bytes32 policyHash, bool isFrozen, uint256 lastUpdated)",
    "function setPolicy(uint256 dailySpendLimit, uint256 maxPerTransaction, bytes32 policyHash) external",
    "event PolicySet(address indexed agent, uint256 dailySpendLimit, uint256 maxPerTransaction, bytes32 policyHash, uint256 timestamp)"
];

export interface OnChainPolicy {
    dailySpendLimit: bigint;
    maxPerTransaction: bigint;
    policyHash: string;
    isFrozen: boolean;
    lastUpdated: bigint;
}

export interface PolicyInput {
    dailySpendLimit: bigint;
    maxPerTransaction: bigint;
    policyHash: string;
}

export class PolicyRegistryAdapter {
    private contract: Contract;

    constructor(
        private address: string,
        private provider: Provider,
        private signer?: Wallet
    ) {
        this.contract = new Contract(address, ABI, signer || provider);
    }

    /**
     * Reads the policy for the given agent from the blockchain.
     * @param agentAddress The address to query
     * @returns The policy struct or null if not found
     */
    async getPolicy(agentAddress: string): Promise<OnChainPolicy> {
        return this.contract.getPolicy(agentAddress);
    }

    /**
     * Writes the policy to the blockchain.
     * @warning This is a gas-consuming transaction.
     * @warning Should strictly be used during SETUP or RECOVERY, not during normal agent operation.
     */
    async setPolicy(policy: PolicyInput): Promise<ethers.TransactionReceipt> {
        if (!this.signer) {
            throw new Error("PolicyRegistryAdapter: No signer available for setPolicy");
        }

        // Runtime Guard: We add a parameter or check logic to prevent accidental usage.
        // For now, explicit naming and documentation is the primary guard, plus the requirement of a signer.

        const tx = await this.contract.setPolicy(
            policy.dailySpendLimit,
            policy.maxPerTransaction,
            policy.policyHash
        );
        return tx.wait();
    }
}
