import { PaymentRequest, WalletContext, AgentWalletConfig } from "./types";
import { PaymentExecutor } from "./executors";
import * as crypto from "crypto";

// Isomorphic Persistence Helper
interface PersistenceLayer {
    load(): any | null;
    save(data: any): void;
}

class NodePersistence implements PersistenceLayer {
    private fs: any;
    private path: any;
    private statePath: string = "";

    constructor() {
        // Dynamic require to avoid bundling issues in browser
        try {
            this.fs = require("fs");
            this.path = require("path");
            this.statePath = this.path.resolve(__dirname, "wallet-state.json");
        } catch (e) { /* Browser environment */ }
    }

    load() {
        if (!this.fs || !this.fs.existsSync(this.statePath)) return null;
        try {
            return JSON.parse(this.fs.readFileSync(this.statePath, "utf-8"));
        } catch (e) {
            console.warn("[WALLET] Failed to load local state file", e);
            return null;
        }
    }

    save(data: any) {
        if (!this.fs) return;
        try {
            const tmpPath = this.statePath + ".tmp";
            this.fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
            this.fs.renameSync(tmpPath, this.statePath);
        } catch (e) {
            console.error("[WALLET] Failed to save local state file", e);
        }
    }
}

class BrowserPersistence implements PersistenceLayer {
    private key = "cronos_agent_wallet_state";
    load() {
        if (typeof localStorage === "undefined") return null;
        const item = localStorage.getItem(this.key);
        return item ? JSON.parse(item) : null;
    }
    save(data: any) {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(this.key, JSON.stringify(data));
    }
}

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
 * - Persists state (Isomorphic: FS or LocalStorage)
 */
export class AgentWallet {
    // ---------------- CONFIG ----------------

    // Reduced limit for testing persistence (0.5 USDC)
    private dailyLimit = 0.5;
    private maxPerTransaction = 0.5; // Default safe limit

    private spentToday = 0.0;
    private lastResetDate = "";

    private allowedMerchants = new Set<string>([]);

    private trustedFacilitatorOrigins = new Set<string>([
        "http://localhost:5000",
        "http://localhost:3000",
        "https://agentx402.onrender.com",
        "https://cronos-x-402-production.up.railway.app",
    ]);

    private stopped = false;
    private persistence: PersistenceLayer;

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
            if (config.maxPerTransaction !== undefined) this.maxPerTransaction = config.maxPerTransaction;
            if (config.allowedMerchants) this.allowedMerchants = new Set(config.allowedMerchants);
            if (config.trustedFacilitators) this.trustedFacilitatorOrigins = new Set(config.trustedFacilitators);
        }

        // Initialize Persistence based on env
        if (typeof window === "undefined") {
            this.persistence = new NodePersistence();
        } else {
            this.persistence = new BrowserPersistence();
        }

        this.loadState();
    }

    // ---------------- PERSISTENCE ----------------

    private getTodayDate(): string {
        return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    }

    private loadState() {
        const state = this.persistence.load() as WalletState;

        if (state) {
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
                console.log(`[WALLET] State loaded. Spent today: ${state.spentToday.toFixed(4)} / ${this.dailyLimit}`);
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
    }

    private saveState() {
        const state: WalletState = {
            lastResetDate: this.lastResetDate,
            spentToday: this.spentToday,
            paidRequests: Array.from(this.paidRequests.entries())
        };
        this.persistence.save(state);
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

        // Support both wrapped { paymentRequest: ... } and raw { ... } structures
        // Robust strategy: Check if 'paymentRequest' key exists, otherwise assume body IS the request if it has 'amount'
        let req = body?.paymentRequest || body;

        // Double check deep nesting (some frameworks might wrap twice)
        if (req?.paymentRequest) req = req.paymentRequest;

        if (!req) {
            throw new Error("Missing 'paymentRequest' in response body");
        }

        const amount = req.amount;
        const currency = req.currency;
        const payTo = req.receiver;
        // Body usually doesn't repeat merchantId
        const merchantId = defaultMerchantId;
        const facilitatorUrl = requestUrl;
        const chainId = req.chainId;
        const route = "premium";

        // [SECURITY] NONCE AUTHORITY
        // Server MUST provide nonce. No fallbacks allowed.
        const nonce = req.nonce;
        if (!nonce) {
            throw new Error("Missing 'nonce' in 402 body - Server is the sole nonce authority.");
        }

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
        context: WalletContext,
        originalChallenge?: { route?: string }
    ): { allow: boolean; reason?: string } {
        // -1. Emergency Stop
        if (this.stopped) {
            return { allow: false, reason: "Emergency stop active" };
        }

        // [SECURITY] Spoofing Check
        // Ensure the route we are paying for matches the invalid route (if known)
        if (originalChallenge?.route && request.route !== originalChallenge.route) {
            return { allow: false, reason: `Route mismatch: Challenge=${request.route}, Expected=${originalChallenge.route}` };
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
        // Enabled for safety test
        if (this.allowedMerchants.size > 0 && !this.allowedMerchants.has(request.merchantId)) {
            return { allow: false, reason: `Merchant not allowlisted: ${request.merchantId}` };
        }

        // 4. Daily spend limit
        // Floating point fix: Use a small epsilon or round
        if ((this.spentToday + request.amount) > (this.dailyLimit + 0.0001)) {
            return { allow: false, reason: `Daily limit exceeded (${this.spentToday.toFixed(2)} + ${request.amount} > ${this.dailyLimit})` };
        }

        // 5. Max Per Transaction Check
        if (request.amount > (this.maxPerTransaction + 0.0001)) {
            return { allow: false, reason: `Transaction limit exceeded (${request.amount} > ${this.maxPerTransaction})` };
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
