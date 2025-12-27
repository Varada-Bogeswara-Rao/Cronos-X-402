// internal/VvsYieldExecutor.ts
import { ethers } from "ethers";
import { YieldExecutor } from "./YieldExecutor";

// Minimal AutoVVS vault ABI (verified)
const AUTO_VVS_VAULT_ABI = [
  "function userInfo(address) view returns (uint256 shares, uint256 lastDepositedTime, uint256 cakeAtLastUserAction, uint256 lastUserActionTime)",
  "function getPricePerFullShare() view returns (uint256)"
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

  // 🚫 Phase 5A boundary
  async harvest(): Promise<number> {
    throw new Error("harvest() not implemented (AutoVVS Phase 5A)");
  }
}
