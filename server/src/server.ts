import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ethers } from 'ethers';
import connectDB from './db';
import { paymentMiddleware } from 'cronos-merchant-payment-middleware';

// Import your routes
import merchantRoutes from './routes/merchantRoutes';
import priceCheck from './routes/priceCheck';
import verifyPayment from './facilitator/verifyPayment';
import sandboxRouter from "./routes/sandbox";

dotenv.config();

// Determine Gateway URL (Mock for demo)
const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:5000";

// 1. Environment Validation
const requiredEnv = ['MONGODB_URI', 'CRONOS_RPC_URL'];
requiredEnv.forEach((env) => {
  if (!process.env[env]) {
    console.error(` Missing environment variable: ${env}`);
    process.exit(1);
  }
});

// 2. Correct Initialization 
const app: Application = express();
const PORT = process.env.PORT || 5000;

// 3. Security & Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.set("trust proxy", 1);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000 // Relaxed for local dev/polling
});
app.use('/api/', limiter);

// 4. Database & Routes
connectDB();

import analyticsRouter from './routes/analytics';
import transactionsRouter from './routes/transactions';

// ...

// [NEW] Dashboard Analytics & Data - MUST BE BEFORE GATEWAY CATCH-ALL
// [NEW] Dashboard Analytics & Data - MUST BE BEFORE GATEWAY CATCH-ALL
app.use('/api/analytics', analyticsRouter);
app.use('/api/transactions', transactionsRouter);

app.use('/api/merchants', merchantRoutes);
app.use('/api/price-check', priceCheck);
app.use('/api/facilitator', verifyPayment);
app.use('/api/sandbox', sandboxRouter); // [SECURE] Sandbox namespace

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'online', service: 'Cronos Merchant Gateway' });
});

// 2. x402 Payment Middleware
// Enforces payment for any route under /api/premium
app.use("/api/premium", paymentMiddleware({
  merchantId: "merchant_01", // Demo Merchant ID
  gatewayUrl: gatewayUrl,    // Self-referential for demo
  facilitatorUrl: gatewayUrl,
  network: "cronos-testnet",
  merchantRegistryAddress: "0x1948175dDB81DA08a4cf17BE4E0C95B97dD11F5c",
  recipientAddress: process.env.FACILITATOR_PRIVATE_KEY
    ? new ethers.Wallet(process.env.FACILITATOR_PRIVATE_KEY).address
    : undefined, // Used for anti-phishing verify
  failMode: "closed"
}));

// [OBSERVABILITY] Health Check (P2)
app.get('/health', async (req: Request, res: Response) => {
  const status: Record<string, any> = { status: 'healthy', timestamp: new Date() };

  try {
    // 1. Check DB
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.admin().ping();
      status.db = 'ok';
    } else {
      throw new Error("DB Not Connected");
    }
  } catch (e: any) {
    status.db = 'error';
    status.dbError = e.message;
    status.healthy = false;
  }

  try {
    // 2. Check RPC
    const provider = new ethers.JsonRpcProvider(process.env.CRONOS_RPC_URL);
    await provider.getBlockNumber();
    status.rpc = 'ok';
  } catch (e: any) {
    status.rpc = 'error';
    status.rpcError = e.message;
    status.healthy = false;
  }

  res.status(status.healthy ? 200 : 503).json(status);
});

// [REMOVED] Background Schedulers


// 5. Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({
    error: true,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});// Forced Restart
// Restart 2
// Restart 3
// Restart 4
// Restart 5
// Restart 6
// Restart 7
// Restart Clean
