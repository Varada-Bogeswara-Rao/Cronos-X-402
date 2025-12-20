// executors.ts
import { PaymentRequest } from "./types";

export interface PaymentExecutor {
  execute(request: PaymentRequest): Promise<string>;
}

// Phase 3A — Mock executor
export class MockPaymentExecutor implements PaymentExecutor {
  async execute(request: PaymentRequest): Promise<string> {
    console.log(
      `[EXECUTOR] Paying ${request.amount} ${request.currency} to ${request.payTo}`
    );
    return `mock_tx_${Date.now()}`;
  }
}
