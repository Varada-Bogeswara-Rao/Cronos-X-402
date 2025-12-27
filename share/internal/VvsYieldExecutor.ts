// internal/VvsYieldExecutor.ts
import { ethers } from "ethers";
import { YieldExecutor } from "./YieldExecutor";

// Minimal AutoVVS vault ABI (verified)
const AUTO_VVS_VAULT_ABI = [
  "function userInfo(address) view returns (uint256 shares, uint256 lastDepositedTime, uint256 cakeAtLastUserAction, uint256 lastUserActionTime)",
  "function getPricePerFullShare() view returns (uint256)",
  "function withdraw(uint256 shares)"
];

// Cronos Mainnet AutoVVS Vault
const AUTO_VVS_VAULT = "0xA6fF77fC8E839679D4F7408E8988B564dE1A2dcD";

export class VvsYieldExecutor implements YieldExecutor {
  private vault: ethers.Contract;

  constructor(
    private readonly provider: ethers.JsonRpcProvider,
    private readonly wallet: ethers.Wallet,
    vaultAddress: string = AUTO_VVS_VAULT
  ) {
    this.vault = new ethers.Contract(
      vaultAddress,
      AUTO_VVS_VAULT_ABI,
      this.provider
    );
  }

  /**
   * READ-ONLY SENSOR (Phase 5A)
   * All values are RAW bigint
   */
  async getVaultPosition(): Promise<{
    shares: bigint;
    pricePerShare: bigint;
    underlyingValue: bigint;
  }> {
    const [userInfo, pricePerShare] = await Promise.all([
      this.vault.userInfo(this.wallet.address) as Promise<[bigint, bigint, bigint, bigint]>,
      this.vault.getPricePerFullShare() as Promise<bigint>
    ]);

    const shares = userInfo[0];

    /**
     * Convention:
     * pricePerShare is scaled by 1e18
     */
    const underlyingValue =
      (shares * pricePerShare) / 10n ** 18n;

    return {
      shares,
      pricePerShare,
      underlyingValue
    };
  }

  async harvest(): Promise<number> {
    // Not implemented in Phase 5/6
    return 0;
  }

  // ⚡ Phase 6: Authorized Execution
  // CRITICAL: amount is SHARES, not underlying
  async withdraw(amount: bigint): Promise<string> {
    console.log(`[VvsYieldExecutor] Executing withdraw for ${amount} SHARES...`);

    // 1. Send Transaction
    const tx = await this.vault.withdraw(amount);
    console.log(`[VvsYieldExecutor] Tx Sent: ${tx.hash}`);

    // 2. Wait for 1 Confirmation (Receipt)
    console.log("[VvsYieldExecutor] Waiting for 1 confirmation...");
    await tx.wait(1);
    console.log("[VvsYieldExecutor] Confirmed!");

    return tx.hash;
  }
}
