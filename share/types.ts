// types.ts
export interface PaymentRequest {
    amount: number;
    currency: string;
    payTo: string;
    merchantId: string;
    facilitatorUrl: string;
}

export interface WalletContext {
    network: string;
    merchantId?: string;
    pendingYield?: number; // mock for now
}
