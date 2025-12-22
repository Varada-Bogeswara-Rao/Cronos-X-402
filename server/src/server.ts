import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './db';

// Import your routes
import merchantRoutes from './routes/merchantRoutes';
import priceCheck from './routes/priceCheck';
import verifyPayment from './facilitator/verifyPayment';
import gatewayRouter from "./routes/gateway";

dotenv.config();

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
  max: 100
});
app.use('/api/', limiter);

// 4. Database & Routes
connectDB();

import analyticsRouter from './routes/analytics';
import transactionsRouter from './routes/transactions';

// ...

app.use('/api/merchants', merchantRoutes);
app.use('/api/price-check', priceCheck);
app.use('/api/facilitator', verifyPayment);
app.use('/api', gatewayRouter);

// [NEW] Dashboard Analytics & Data
app.use('/api/analytics', analyticsRouter);
app.use('/api/transactions', transactionsRouter);

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'online', service: 'Cronos Merchant Gateway' });
});

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
});