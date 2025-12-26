import { ethers } from "ethers";
import { YieldExecutor } from "./YieldExecutor";

export class VvsYieldExecutor implements YieldExecutor {
  constructor(
    private provider: ethers.JsonRpcProvider,
    private wallet: ethers.Wallet,
    private glitterMineAddress: string
  ) {}

  async getPendingYield(): Promise<number> {
    // TODO: read pending rewards from VVS contract
    return 0;
  }

  async harvest(): Promise<number> {
    // TODO: call harvest() on VVS
    // return harvested USDC amount
    return 0;
  }
}
