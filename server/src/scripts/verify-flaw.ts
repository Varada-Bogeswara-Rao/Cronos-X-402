import axios from 'axios';
import { ethers } from 'ethers';

const BASE_URL = 'http://localhost:5000/api';
const WALLET_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY);

async function verifyFlaw() {
    try {
        console.log(`🕵️ Starting Vulnerability Check...`);

        // 1. Register a Merchant
        const registerRes = await axios.post(`${BASE_URL}/merchants/register`, {
            business: { name: "Flaw Test", description: "Testing", contactEmail: "flaw@test.com" },
            wallet: { address: wallet.address, network: "cronos-testnet" },
            // Use a reliable echo server to verify the proxy works
            api: { baseUrl: "https://jsonplaceholder.typicode.com", routes: [] },
            limits: { maxRequestsPerMinute: 60 }
        });
        const { merchantId } = registerRes.data;
        console.log(`✅ Step 1: Merchant Registered (ID: ${merchantId})`);

        // 2. Add a Monetized Route
        const ts = Date.now().toString();
        const msg = `Update Routes for Merchant ${merchantId} at ${ts}`;
        const sig = await wallet.signMessage(msg);

        await axios.post(`${BASE_URL}/merchants/${merchantId}/routes`, {
            method: "GET", path: "/todos/1", price: "5.0", currency: "USDC"
        }, {
            headers: { 'x-signature': sig, 'x-timestamp': ts, 'x-merchant-id': merchantId }
        });
        console.log(`✅ Step 2: Monetized Route Added (/todos/1 -> Price: 5.0 USDC)`);

        // 3. EXPLOIT: Access the route WITHOUT Payment
        console.log(`\n☠️ Step 3: Attempting UNPAID Access via Gateway...`);
        console.log(`Request: GET ${BASE_URL}/todos/1 (No Payment Headers)`);

        try {
            // Note: We're hitting the [NEW] Sandbox route
            // The gateway mounts at /api/sandbox/:merchantId/*
            console.log(`Target: ${BASE_URL}/sandbox/${merchantId}/todos/1`);

            const response = await axios.get(`${BASE_URL}/sandbox/${merchantId}/todos/1`, {
                headers: { 'x-is-sandbox': 'true' }
            });

            // IF WE REACH HERE, THE FLAW EXISTS
            console.log(`\n🚨 CRITICAL VULNERABILITY CONFIRMED! 🚨`);
            console.log(`Response Status: ${response.status} OK`);
            console.log(`Data Received:`, response.data);
            console.log(`\nCONCLUSION: The Gateway PROXIED the request WITHOUT requiring payment.`);

        } catch (error: any) {
            if (error.response?.status === 402) {
                console.log(`\n✅ SECURE: Request Blocked (402 Payment Required)`);
            } else {
                console.log(`\n❌ Unexpected Error:`, error.message);
                if (error.response) console.log(error.response.data);
            }
        }

    } catch (error: any) {
        console.error("Setup Failed:", error.message);
        if (error.code) console.error("Error Code:", error.code);
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error("No response received from server.");
        }
    }
}

verifyFlaw();
