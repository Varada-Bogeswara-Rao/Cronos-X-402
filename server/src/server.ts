import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './db';
import merchantRoutes from './routes/merchantRoutes';
import priceCheck from './routes/priceCheck';
import verifyPayment from './facilitator/verifyPayment';
import paidProxyRouter from "./routes/paidProxy";
import { paymentMiddleware } from "./middleware/paymentMiddleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
connectDB();

// Routes
app.use('/api/merchants', merchantRoutes);
app.use('/api/price-check', priceCheck);
app.use('/api', verifyPayment);
app.use(
    "/api",
    paymentMiddleware({
        merchantId: "60fa3d1c-8357-496b-a312-fe41c5cd2909",
        gatewayUrl: "http://localhost:5000",
        facilitatorUrl: "http://localhost:5000",
        network: "cronos-testnet"
    })
    ,
    paidProxyRouter
);

app.get('/', (req, res) => {
    res.send('Cronos Merchant Gateway API');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
