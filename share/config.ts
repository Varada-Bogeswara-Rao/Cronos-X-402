// config.ts
export interface AgentConfig {
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  usdcAddress: string;

  // Optional safety controls
  dailyLimit?: number;
  allowedMerchants?: string[];
  trustedFacilitators?: string[];

  // Optional context
  merchantId?: string;
  pendingYield?: number;
}
