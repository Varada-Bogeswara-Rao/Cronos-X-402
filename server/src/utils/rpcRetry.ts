import { ethers } from 'ethers';

export async function withRpcRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            lastError = err;
            if (attempt === maxRetries) break;
            const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
            console.warn(`[RPC] Retry ${attempt}/${maxRetries} after ${delay.toFixed(0)}ms`, err.message);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}
