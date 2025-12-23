// AgentWallet.ts
import * as fs from "fs";
import * as path from "path";
import { PaymentRequest, WalletContext, AgentWalletConfig } from "./types";
import { PaymentExecutor } from "./executors";

const STATE_FILE = path.resolve(__dirname, "wallet-state.json");

interface WalletState {
    lastResetDate: string;
    spentToday: number;
    paidRequests: [string, number][]; // Serialize Map as entries
}

/**
 * AgentWallet
 * ------------
 * - Owns identity (address)
 * - Decides whether to pay
 * - Delegates execution to PaymentExecutor
 * - Enforces security + policy
 * - [NEW] Persists state to local JSON
 */
export class AgentWallet {
    // ---------------- CONFIG ----------------

    // Reduced limit for testing persistence (0.2 USDC)
    // Reduced limit for testing persistence (0.2 USDC)
    private dailyLimit = 0.5;

    private spentToday = 0.0;
    private lastResetDate = "";

    private allowedMerchants = new Set<string>([
        "60fa3d1c-8357-496b-a312-fe41c5cd2909",
        "2bbc88c5-afc3-4f67-93fb-c38df67fa028",
        "eb16bd95-62b6-4e4d-bad0-c54b372ad822",
        "ec85b480-0874-4c67-9b21-596d593394b0",
        "b9805b9e-fa6c-4640-8470-f5b230dee6d4",
    ]);

    private trustedFacilitatorOrigins = new Set<string>([
        "http://localhost:5000",
        "http://localhost:3000",
        "https://agentx402.onrender.com",
        "https://cronos-x-402-production.up.railway.app",
    ]);

    private stopped = false;

    /**
     * Replay protection
     * key -> timestamp
     */
    private paidRequests = new Map<string, number>();

    constructor(
        private readonly address: string,
        private readonly executor: PaymentExecutor,
        config?: AgentWalletConfig
    ) {
        if (config) {
            if (config.dailyLimit !== undefined) this.dailyLimit = config.dailyLimit;
            if (config.allowedMerchants) this.allowedMerchants = new Set(config.allowedMerchants);
            if (config.trustedFacilitators) this.trustedFacilitatorOrigins = new Set(config.trustedFacilitators);
        }
        this.loadState();
    }

    // ---------------- PERSISTENCE ----------------

    private getTodayDate(): string {
        return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    }

    private loadState() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const raw = fs.readFileSync(STATE_FILE, "utf-8");
                const state: WalletState = JSON.parse(raw);

                // 1. Check if we need to reset for a new day
                const today = this.getTodayDate();
                if (state.lastResetDate !== today) {
                    console.log(`[WALLET] New day detected! Resetting limit. (Last: ${state.lastResetDate}, Today: ${today})`);
                    this.spentToday = 0;
                    this.lastResetDate = today;

                    // Cleanup old requests (older than 24h) to prevent memory leak
                    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
                    const now = Date.now();
                    this.paidRequests = new Map(
                        state.paidRequests.filter(([_, ts]) => now - ts < MAX_AGE_MS)
                    );
                } else {
                    console.log(`[WALLET] State loaded. Spent today: ${state.spentToday} / ${this.dailyLimit}`);
                    this.spentToday = state.spentToday;
                    this.lastResetDate = state.lastResetDate;

                    // Also cleanup on every load to be safe
                    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
                    const now = Date.now();
                    this.paidRequests = new Map(
                        state.paidRequests.filter(([_, ts]) => now - ts < MAX_AGE_MS)
                    );
                }
            } else {
                // Initialize fresh
                this.lastResetDate = this.getTodayDate();
            }
        } catch (err) {
            console.error("[WALLET] Failed to load state:", err);
        }
    }

    private saveState() {
        try {
            const state: WalletState = {
                lastResetDate: this.lastResetDate,
                spentToday: this.spentToday,
                paidRequests: Array.from(this.paidRequests.entries())
            };
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        } catch (err) {
            console.error("[WALLET] Failed to save state:", err);
        }
    }

    // ---------------- PUBLIC ----------------

    public getAddress(): string {
        return this.address;
    }

    // ---------------- HELPERS ----------------

    private getHeader(headers: any, key: string): string | undefined {
        return headers[key] ?? headers[key.toLowerCase()];
    }

    private canonicalOrigin(url: string): string {
        try {
            return new URL(url).origin;
        } catch {
            return "";
        }
    }

    /**
     * Strong uniqueness:
     * merchant + route + nonce
     */
    private paymentKey(req: PaymentRequest): string {
        return `${req.merchantId}:${req.route}:${req.nonce}`;
    }

    // ---------------- x402 PARSER ----------------

    public parse402Header(headers: any): PaymentRequest {
        const amount = this.getHeader(headers, "x-payment-amount");
        const currency = this.getHeader(headers, "x-payment-currency");
        const payTo = this.getHeader(headers, "x-payment-payto");
        const merchantId = this.getHeader(headers, "x-merchant-id");
        const facilitatorUrl = this.getHeader(headers, "x-facilitator-url");
        const chainId = this.getHeader(headers, "x-chain-id");
        const route = this.getHeader(headers, "x-route");
        const nonce = this.getHeader(headers, "x-nonce");

        if (
            !amount ||
            !currency ||
            !payTo ||
            !merchantId ||
            !facilitatorUrl ||
            !chainId ||
            !route ||
            !nonce
        ) {
            throw new Error("Malformed x402 payment headers");
        }

        return {
            amount: Number(amount),
            currency,
            payTo,
            merchantId,
            facilitatorUrl,
            chainId: Number(chainId),
            route,
            nonce,
        };
    }

    public parse402Body(body: any, defaultMerchantId: string, requestUrl: string): PaymentRequest {
        // Expecting body structure:
        // { paymentRequest: { chainId, currency, receiver, amount, token ... } }

        const req = body?.paymentRequest;
        if (!req) {
            throw new Error("Missing 'paymentRequest' in response body");
        }

        const amount = req.amount;
        const currency = req.currency;
        const payTo = req.receiver;
        const merchantId = defaultMerchantId; // Body usually doesn't repeat merchantId
        const facilitatorUrl = requestUrl; // Use the actual URL we called
        const chainId = req.chainId;
        const route = "premium"; // Default or extract
        const nonce = Date.now().toString(); // Fallback if backend doesn't provide unique nonce

        if (!amount || !currency || !payTo || !chainId) {
            throw new Error(`Incomplete 402 body: ${JSON.stringify(req)}`);
        }

        return {
            amount: Number(amount),
            currency,
            payTo,
            merchantId,
            facilitatorUrl, // Contextual
            chainId: Number(chainId),
            route,
            nonce,
        };
    }

    // ---------------- RULES ENGINE ----------------

    public emergencyStop() {
        this.stopped = true;
        console.warn("[WALLET] Emergency stop activated!");
    }

    public shouldPay(
        request: PaymentRequest,
        context: WalletContext
    ): { allow: boolean; reason?: string } {
        // -1. Emergency Stop
        if (this.stopped) {
            return { allow: false, reason: "Emergency stop active" };
        }

        // 0. Currency check [NEW]
        if (request.currency !== "USDC") {
            return { allow: false, reason: `Unsupported currency: ${request.currency}` };
        }

        // 1. Chain verification
        if (request.chainId !== context.chainId) {
            return { allow: false, reason: "ChainId mismatch" };
        }

        // 2. Facilitator trust
        const origin = this.canonicalOrigin(request.facilitatorUrl);
        if (!this.trustedFacilitatorOrigins.has(origin)) {
            return { allow: false, reason: "Untrusted facilitator" };
        }

        // 3. Merchant allowlist
        // DISABLED per user request for global compatibility
        // if (!this.allowedMerchants.has(request.merchantId)) {
        //     return { allow: false, reason: `Merchant not allowlisted: ${request.merchantId}` };
        // }

        // 4. Daily spend limit
        // Floating point fix: Use a small epsilon or round
        if ((this.spentToday + request.amount) > (this.dailyLimit + 0.0001)) {
            return { allow: false, reason: `Daily limit exceeded (${this.spentToday.toFixed(2)} + ${request.amount} > ${this.dailyLimit})` };
        }

        // 5. Yield-only mode (optional)
        if (
            context.pendingYield !== undefined &&
            context.pendingYield < request.amount
        ) {
            return { allow: false, reason: "Insufficient yield balance" };
        }

        return { allow: true };
    }

    // ---------------- PAYMENT EXECUTION ----------------

    public async executePayment(request: PaymentRequest): Promise<string> {
        const key = this.paymentKey(request);

        if (this.paidRequests.has(key)) {
            throw new Error("Replay detected: payment already executed");
        }

        // Execute chain tx
        const proof = await this.executor.execute(request);

        // Update state
        this.spentToday += request.amount;
        this.paidRequests.set(key, Date.now());

        // Persist immediately
        this.saveState();

        return proof;
    }
}
