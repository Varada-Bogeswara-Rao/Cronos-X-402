import { PaymentReceipt } from "./paymentMiddleware";

export * from "./paymentMiddleware";

declare global {
  namespace Express {
    interface Request {
      payment?: PaymentReceipt;
    }
  }
}
