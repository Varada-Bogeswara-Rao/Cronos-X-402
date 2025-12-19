import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Merchant from '../models/Merchant';

const router = express.Router();

// POST /api/merchants/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
        const { business, wallet, api, limits, security } = req.body;

        const newMerchant = new Merchant({
            merchantId: uuidv4(),
            business,
            wallet,
            api,
            limits,
            security
        });

        const savedMerchant = await newMerchant.save();
        res.status(201).json(savedMerchant);
    } catch (error) {
        console.error('Error registering merchant:', error);
        res.status(500).json({ message: 'Server error registering merchant', error });
    }
});

export default router;
