"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const ethers_1 = require("ethers");
const db_1 = __importDefault(require("./db"));
// Import your routes
const merchantRoutes_1 = __importDefault(require("./routes/merchantRoutes"));
const priceCheck_1 = __importDefault(require("./routes/priceCheck"));
const verifyPayment_1 = __importDefault(require("./facilitator/verifyPayment"));
const sandbox_1 = __importDefault(require("./routes/sandbox"));
dotenv_1.default.config();
// 1. Environment Validation
const requiredEnv = ['MONGODB_URI', 'CRONOS_RPC_URL'];
requiredEnv.forEach((env) => {
    if (!process.env[env]) {
        console.error(` Missing environment variable: ${env}`);
        process.exit(1);
    }
});
// 2. Correct Initialization 
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// 3. Security & Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10kb' }));
app.set("trust proxy", 1);
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5000 // Relaxed for local dev/polling
});
app.use('/api/', limiter);
// 4. Database & Routes
(0, db_1.default)();
const analytics_1 = __importDefault(require("./routes/analytics"));
const transactions_1 = __importDefault(require("./routes/transactions"));
// ...
// [NEW] Dashboard Analytics & Data - MUST BE BEFORE GATEWAY CATCH-ALL
// [NEW] Dashboard Analytics & Data - MUST BE BEFORE GATEWAY CATCH-ALL
app.use('/api/analytics', analytics_1.default);
app.use('/api/transactions', transactions_1.default);
app.use('/api/merchants', merchantRoutes_1.default);
app.use('/api/price-check', priceCheck_1.default);
app.use('/api/facilitator', verifyPayment_1.default);
app.use('/api/sandbox', sandbox_1.default); // [SECURE] Sandbox namespace
app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'Cronos Merchant Gateway' });
});
// [OBSERVABILITY] Health Check (P2)
app.get('/health', async (req, res) => {
    const status = { status: 'healthy', timestamp: new Date() };
    try {
        // 1. Check DB
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.connection.db?.admin().ping();
            status.db = 'ok';
        }
        else {
            throw new Error("DB Not Connected");
        }
    }
    catch (e) {
        status.db = 'error';
        status.dbError = e.message;
        status.healthy = false;
    }
    try {
        // 2. Check RPC
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.CRONOS_RPC_URL);
        await provider.getBlockNumber();
        status.rpc = 'ok';
    }
    catch (e) {
        status.rpc = 'error';
        status.rpcError = e.message;
        status.healthy = false;
    }
    res.status(status.healthy ? 200 : 503).json(status);
});
// [REMOVED] Background Schedulers
// 5. Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    res.status(err.status || 500).json({
        error: true,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); // Forced Restart
// Restart 2
// Restart 3
// Restart 4
// Restart 5
// Restart 6
// Restart 7
// Restart Clean
