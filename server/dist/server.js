"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./db"));
const merchantRoutes_1 = __importDefault(require("./routes/merchantRoutes"));
const priceCheck_1 = __importDefault(require("./routes/priceCheck"));
const verifyPayment_1 = __importDefault(require("./facilitator/verifyPayment"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Database Connection
(0, db_1.default)();
// Routes
app.use('/api/merchants', merchantRoutes_1.default);
app.use('/api/price-check', priceCheck_1.default);
app.use('/api', verifyPayment_1.default);
app.get('/', (req, res) => {
    res.send('Cronos Merchant Gateway API');
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
