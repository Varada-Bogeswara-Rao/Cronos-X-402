// AgentWallet.ts
import { PaymentRequest, WalletContext } from "./types";
import { PaymentExecutor } from "./executors";

export class AgentWallet {
    private dailyLimit = 5.0;
    private spentToday = 0.0;

    private allowedMerchants = [
        "60fa3d1c-8357-496b-a312-fe41c5cd2909",
        "2bbc88c5-afc3-4f67-93fb-c38df67fa028",
        "eb16bd95-62b6-4e4d-bad0-c54b372ad822",
        "ec85b480-0874-4c67-9b21-596d593394b0",
        "b9805b9e-fa6c-4640-8470-f5b230dee6d4"
    ];

    private trustedFacilitators = [
        "http://localhost:5000",
        "https://cronos-x-402-production.up.railway.app",
        "https://cronos-x-402-production.up.railway.app/api/facilitator"
    ];

    private paidRequests = new Set<string>();

    constructor(private executor: PaymentExecutor) { }

    // ---------- Helpers ----------
    private getHeader(headers: any, key: string): string | undefined {
        return headers[key] || headers[key.toLowerCase()];
    }

    private paymentKey(req: PaymentRequest): string {
        return `${req.merchantId}:${req.amount}:${req.payTo}`;
    }

    // ---------- 1. x402 Header Parser ----------
    public parse402Header(headers: any): PaymentRequest {
        const amount = this.getHeader(headers, "x-payment-amount");
        const currency = this.getHeader(headers, "x-payment-currency");
        const payTo = this.getHeader(headers, "x-payment-payto");
        const merchantId = this.getHeader(headers, "x-merchant-id");
        const facilitatorUrl = this.getHeader(headers, "x-facilitator-url");

        if (!amount || !currency || !payTo || !merchantId || !facilitatorUrl) {
            throw new Error("Malformed x402 payment headers");
        }

        return {
            amount: Number(amount),
            currency,
            payTo,
            merchantId,
            facilitatorUrl
        };
    }

    // ---------- 2. Context-Aware Rules Engine ----------
    public shouldPay(
        request: PaymentRequest,
        context: WalletContext
    ): { allow: boolean; reason?: string } {
        if (!this.allowedMerchants.includes(request.merchantId)) {
            return { allow: false, reason: "Merchant not allowlisted" };
        }

        if (!this.trustedFacilitators.includes(request.facilitatorUrl)) {
            return { allow: false, reason: "Untrusted facilitator" };
        }

        if (context.network !== "cronos-testnet") {
            return { allow: false, reason: "Invalid network" };
        }

        if (this.spentToday + request.amount > this.dailyLimit) {
            return { allow: false, reason: "Daily limit exceeded" };
        }

        // 🔥 Yield-only mode (mock)
        if (
            context.pendingYield !== undefined &&
            context.pendingYield < request.amount
        ) {
            return { allow: false, reason: "Insufficient yield balance" };
        }

        return { allow: true };
    }

    // ---------- 3. Payment Executor ----------
    public async executePayment(request: PaymentRequest): Promise<string> {
        const key = this.paymentKey(request);

        if (this.paidRequests.has(key)) {
            throw new Error("Duplicate payment attempt blocked");
        }

        const proof = await this.executor.execute(request);

        this.spentToday += request.amount;
        this.paidRequests.add(key);

        return proof;
    }

    public getAddress(): string {
        // We need to cast to any or add getAddress to the interface if strict
        // For now, assuming the executor might have a wallet or we need to access it
        // Check if executor has a wallet property or if we can get it.
        // Wait, the executor interface is generic. Let's inspect CronosUsdcExecutor.
        return (this.executor as any).wallet?.address || "0xUNKNOWN";
    }
}
