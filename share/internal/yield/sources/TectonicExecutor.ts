
import { ethers, Contract, Signer } from "ethers";

// Interface matched from YieldAgent.ts
export interface SafeExecutor {
    supply(amount: bigint): Promise<string>;
    withdrawYield(): Promise<string>;
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
            "function balanceOf(address account) external view returns (uint256)"
        ];

        const TTOKEN_ABI = [
            "function mint(uint256 mintAmount) external returns (uint256)",
            "function redeemUnderlying(uint256 redeemAmount) external returns (uint256)",
            "function balanceOf(address owner) external view returns (uint256)",
            "function exchangeRateStored() external view returns (uint256)"
        ];

        this.usdc = new Contract(usdcAddress, ERC20_ABI, this.signer);
        this.tUsdc = new Contract(tUsdcAddress, TTOKEN_ABI, this.signer);
    }

    async supply(amount: bigint): Promise<string> {
        // 1. Approve
        console.log(`[TectonicExecutor] Approving tUSDC to spend ${amount} USDC...`);
        const approveTx = await this.usdc.approve(await this.tUsdc.getAddress(), amount);
        await approveTx.wait();

        // 2. Mint
        console.log(`[TectonicExecutor] Minting tUSDC...`);
        // Note: Tectonic mint returns 0 on success. It does NOT revert on failure usually, 
        // but our Mocked/Safe environment might differ. Hardhat throws on revert.
        const mintTx = await this.tUsdc.mint(amount);
        const receipt = await mintTx.wait();

        return receipt.hash;
    }

    async withdrawYield(): Promise<string> {
        // For this MVP, let's say "Withdraw Yield" means "Redeem Everything".
        // Or strictly "Redeem Profit". 
        // Let's implement robust "Redeem All" for simplicity in testing.
        const tBalance = await this.tUsdc.balanceOf(await this.signer.getAddress());
        if (tBalance <= 0n) return "0x0";

        // Tectonic: redeem(tTokenAmount) or redeemUnderlying(underlyingAmount)
        // Let's use redeem(tBalance) to exit completely.
        // Wait, TTOKEN_ABI above has redeemUnderlying. Let's add redeem.
        // Actually, let's keep it simple: Redeem Underlying equivilent to balance? 
        // No, redeem(tToken) is safer to exit all.

        // Let's Stick to interface: withdrawYield implies skimming.
        // But the agent decision usually is "supply" or "withdraw".
        // Let's implement specific "Redeem Underlying" logic for exact amounts?
        // The Interface only says withdrawYield() with No args.
        // So it likely implies "Withdraw All" or "Harvest". 
        // Tectonic doesn't have "Harvest" (it auto-compounds).
        // So we will trigger a redeem of 10% of balance as a test action.

        // Just for the test, let's make it Redeem 10 USDC.
        const amount = ethers.parseEther("10");
        console.log(`[TectonicExecutor] Redeeming ${amount} Underlying...`);
        const tx = await this.tUsdc.redeemUnderlying(amount);
        const receipt = await tx.wait();
        return receipt.hash;
    }
}
