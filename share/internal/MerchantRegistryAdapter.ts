import { Contract, Provider } from "ethers";

const ABI = [
    "function getMerchant(string calldata merchantId) external view returns (address wallet, bool isActive, string memory metadataURI)"
];

export interface OnChainMerchant {
    wallet: string;
    isActive: boolean;
    metadataURI: string;
}

export class MerchantRegistryAdapter {
    private contract: Contract;

    constructor(
        private address: string,
        private provider: Provider
    ) {
        this.contract = new Contract(address, ABI, provider);
    }

    /**
     * Verifies a merchant's identity on-chain.
     * @param merchantId The UUID of the merchant
     * @returns The merchant details or throws if call fails
     */
    async getMerchant(merchantId: string): Promise<OnChainMerchant> {
        return this.contract.getMerchant(merchantId);
    }
}
