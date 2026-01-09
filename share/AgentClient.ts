// AgentClient.ts
import { AgentWallet } from "./internal/AgentWallet";
import { CronosUsdcExecutor } from "./internal/CronosUsdcExecutor";
import { x402Request } from "./internal/x402ToolClient";
import { WalletContext } from "./internal/types";
import { AgentConfig } from "./config";

/**
 * AgentClient
 * -----------
 * Public SDK entry.
 * - One instance per user/session
 * - Wraps wallet + executor + x402 flow
 */
export class AgentClient {
  private wallet: AgentWallet;
  private context: WalletContext;

  constructor(config: AgentConfig) {
    if (!config.privateKey) {
      throw new Error("AgentClient: privateKey is required");
    }
    if (!config.rpcUrl) {
      throw new Error("AgentClient: rpcUrl is required");
    }
    if (!config.chainId) {
      throw new Error("AgentClient: chainId is required");
    }

    // 1. Create executor (chain-specific)
    const executor = new CronosUsdcExecutor(
      config.rpcUrl,
      config.privateKey,
      config.usdcAddress,
      config.chainId
    );

    // 2. Create wallet (policy + persistence)
    this.wallet = new AgentWallet(
      executor.getAddress(),
      executor,
      {
        dailyLimit: config.dailyLimit,
        trustedFacilitators: config.trustedFacilitators,
        allowedMerchants: config.allowedMerchants,
      }
    );

    // 3. Context passed per request
    this.context = {
      chainId: config.chainId,
      merchantId: config.merchantId,
    };
  }

  /**
   * agent.fetch()
   * --------------
   * Drop-in replacement for fetch/axios
   * Handles:
   * - free APIs
   * - x402 paid APIs
   * - auto-pay + retry
   */
  async fetch<T>(
    url: string,
    options?: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: any;
    }
  ): Promise<T> {
    console.log("[SDK] AgentClient.fetch called");
    console.log(`[SDK] URL: ${url}`);
    console.log(`[SDK] Options:`, options);
    return x402Request(url, this.wallet, this.context, options);
  }

  /**
   * Emergency stop
   */
  stop() {
    this.wallet.emergencyStop();
  }

  /**
   * Wallet address (agent wallet)
   */
  getAddress(): string {
    return this.wallet.getAddress();
  }
}
