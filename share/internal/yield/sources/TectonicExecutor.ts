
import { ethers, Contract, Signer } from "ethers";

// Interface matched from YieldAgent.ts
export interface SafeExecutor {
    supply(amount: bigint): Promise<string>;
    withdrawYield(): Promise<string>;
    withdraw(amount: bigint): Promise<string>;
}

export class TectonicExecutor implements SafeExecutor {
    private signer: Signer;
    private usdc: Contract;
    private tUsdc: Contract;

    constructor(
        signer: ethers.Signer,
        usdcAddress: string,
        tUsdcAddress: string
    ) {
        this.signer = signer;

        // Minimal ABI for interactions
        const ERC20_ABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function balanceOf(address account) external view returns (uint256)"
        ];

        const TTOKEN_ABI = [
            "function mint(uint256 mintAmount) external returns (uint256)",
            "function redeem(uint256 redeemTokens) external returns (uint256)",
            "function redeemUnderlying(uint256 redeemAmount) external returns (uint256)",
            "function balanceOf(address owner) external view returns (uint256)",
            "function exchangeRateStored() external view returns (uint256)"
        ];

        this.usdc = new Contract(usdcAddress, ERC20_ABI, this.signer);
        this.tUsdc = new Contract(tUsdcAddress, TTOKEN_ABI, this.signer);
    }

    async supply(amount: bigint): Promise<string> {
        // 1. Check Allowance & Approve (Unlimited)
        const spender = await this.tUsdc.getAddress();
        const owner = await this.signer.getAddress();

        // ABI now includes allowance, so we can call it directly.
        // Note: Contract is typed as generic Contract, so TS might complain if strict.
        // But functionally it works. casting for TS safety if needed.
        const allowance = await this.usdc.allowance(owner, spender);

        if (allowance < amount) {
            console.log(`[TectonicExecutor] Allowance ${allowance} < ${amount}. Approving MaxUint256...`);
            const tx = await this.usdc.approve(spender, ethers.MaxUint256);
            await tx.wait();
        } else {
            console.log(`[TectonicExecutor] Allowance ${allowance} sufficient.`);
        }

        // 2. Mint
        console.log(`[TectonicExecutor] Minting tUSDC...`);
        const mintTx = await this.tUsdc.mint(amount);
        const receipt = await mintTx.wait();

        return receipt.hash;
    }

    async withdraw(amount: bigint): Promise<string> {
        console.log(`[TectonicExecutor] Redeeming ${amount} Underlying USDC...`);
        const tx = await this.tUsdc.redeemUnderlying(amount);
        const receipt = await tx.wait();
        return receipt.hash;
    }

    async withdrawAll(): Promise<string> {
        const owner = await this.signer.getAddress();
        const tBalance = await this.tUsdc.balanceOf(owner);

        if (tBalance <= 0n) {
            console.warn("[TectonicExecutor] No balance to withdraw.");
            return "0x0";
        }

        console.log(`[TectonicExecutor] Emergency Exit: Redeeming ${tBalance} tUSDC (ALL)...`);
        // redeem(tTokenAmount) exits the position entirely
        const tx = await this.tUsdc.redeem(tBalance);
        const receipt = await tx.wait();
        return receipt.hash;
    }

    // Validating Interface Compliance (Legacy)
    async withdrawYield(): Promise<string> {
        return this.withdrawAll();
    }
}
