// AgentClient.ts
import { AgentWallet } from "./internal/AgentWallet";
import { CronosUsdcExecutor } from "./internal/CronosUsdcExecutor";
import { x402Request } from "./internal/x402ToolClient";
import { WalletContext } from "./internal/types";
import { AgentConfig, AGENT_CONFIG_DEFAULTS } from "./config";

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
    // 0. Merge with defaults
    const fullConfig = { ...AGENT_CONFIG_DEFAULTS, ...config };

    if (!fullConfig.privateKey) {
      throw new Error("AgentClient: privateKey is required");
    }
    if (!fullConfig.rpcUrl) {
      throw new Error("AgentClient: rpcUrl is required");
    }
    if (!fullConfig.chainId) {
      throw new Error("AgentClient: chainId is required");
    }

    // 1. Create executor (chain-specific)
    const executor = new CronosUsdcExecutor(
      fullConfig.rpcUrl,
      fullConfig.privateKey,
      fullConfig.usdcAddress,
      fullConfig.chainId
    );

    // 2. Create wallet (policy + persistence)
    this.wallet = new AgentWallet(
      executor.getAddress(),
      executor,
      executor.getProvider(),
      executor.getSigner(),
      fullConfig
    );

    // 3. Context passed per request
    this.context = {
      chainId: config.chainId,
      merchantId: config.merchantId,
      analyticsUrl: config.analyticsUrl
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
      allowBodyFallback?: boolean;
    }
  ): Promise<T> {
    const res = await this.fetchWithDetails<T>(url, options);
    return res.data;
  }

  async fetchWithDetails<T>(
    url: string,
    options?: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: any;
      timeoutMs?: number;
      allowBodyFallback?: boolean;
    }
  ): Promise<{ data: T; payment: any }> {
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
