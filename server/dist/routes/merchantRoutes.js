"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const Merchant_1 = __importDefault(require("../models/Merchant"));
const router = express_1.default.Router();
// POST /api/merchants/register
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { business, wallet, api, limits, security } = req.body;
        const newMerchant = new Merchant_1.default({
            merchantId: (0, uuid_1.v4)(),
            business,
            wallet,
            api,
            limits,
            security
        });
        const savedMerchant = yield newMerchant.save();
        res.status(201).json(savedMerchant);
    }
    catch (error) {
        console.error('Error registering merchant:', error);
        res.status(500).json({ message: 'Server error registering merchant', error });
    }
}));
exports.default = router;
