export interface OnChainAnchors {
  merchantRegistry?: string;
  agentPolicyRegistry?: string;
  policyVerifier?: string;
}

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
  analyticsUrl?: string; // Centralized logging

  // Exoskeleton: On-chain enforcement
  anchors?: OnChainAnchors;
  strictPolicy?: boolean; // If true, throws on on-chain hash mismatch

  // Optional context
  merchantId?: string;
}

export const AGENT_CONFIG_DEFAULTS = {
  // Cronos Testnet Anchors
  anchors: {
    merchantRegistry: "0x1948175dDB81DA08a4cf17BE4E0C95B97dD11F5c",
    agentPolicyRegistry: "0xce3b58c9ae8CA4724d6FA8684d2Cb89546FF4E43",
    policyVerifier: "0xFCb2D2279256B62A1E4E07BCDed26B6546bBc33b"
  }
};
