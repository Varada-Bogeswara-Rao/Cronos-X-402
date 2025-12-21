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
const db_1 = __importDefault(require("./db"));
// Import your routes
const merchantRoutes_1 = __importDefault(require("./routes/merchantRoutes"));
const priceCheck_1 = __importDefault(require("./routes/priceCheck"));
const verifyPayment_1 = __importDefault(require("./facilitator/verifyPayment"));
const gateway_1 = __importDefault(require("./routes/gateway"));
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
    max: 100
});
app.use('/api/', limiter);
// 4. Database & Routes
(0, db_1.default)();
app.use('/api/merchants', merchantRoutes_1.default);
app.use('/api/price-check', priceCheck_1.default);
app.use('/api/facilitator', verifyPayment_1.default);
app.use('/api', gateway_1.default);
app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'Cronos Merchant Gateway' });
});
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
});
