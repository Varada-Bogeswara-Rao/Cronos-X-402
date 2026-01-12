// config.ts
export interface AgentConfig {
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  usdcAddress: string;

  // Optional safety controls
  dailyLimit?: number;
  maxPerTransaction?: number;
  allowedMerchants?: string[];
  trustedFacilitators?: string[];
  analyticsUrl?: string; // [NEW] Centralized logging

  // Optional context
  merchantId?: string;
}
