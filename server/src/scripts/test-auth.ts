import { ethers } from 'ethers';
import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:5000/api/merchants';
const WALLET_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234'; // Dummy key
const OTHER_WALLET_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111'; // Hacker key

const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY);
const hacker = new ethers.Wallet(OTHER_WALLET_KEY);

console.log(`🔐 Testing Wallet Auth`);
console.log(`Merchant Wallet: ${wallet.address}`);
console.log(`Hacker Wallet:   ${hacker.address}`);

async function runTest() {
    try {
        // 1. Register Merchant
        console.log(`\n[1] Registering Merchant...`);
        const registerRes = await axios.post(`${BASE_URL}/register`, {
            business: { name: "Test Biz", description: "Testing Auth", contactEmail: "test@example.com" },
            wallet: { address: wallet.address, network: "cronos-testnet" },
            api: { baseUrl: "https://example.com", routes: [] },
            limits: { maxRequestsPerMinute: 60 }
        });

        const { merchantId } = registerRes.data;
        console.log(`✅ Registered! Merchant ID: ${merchantId}`);
        if (registerRes.data.apiKey) console.error("❌ FAILURE: API Key should NOT be returned!");

        // 2. Try adding a route WITHOUT signature (Should Fail)
        console.log(`\n[2] Attempting Unsigned Request (Should Fail)...`);
        try {
            await axios.post(`${BASE_URL}/${merchantId}/routes`, {
                method: "GET", path: "/test", price: "1", currency: "USDC"
            });
            console.error("❌ FAILURE: Unsigned request succeeded (should be 401)");
        } catch (e: any) {
            if (e.response?.status === 401) console.log("✅ Success: Unsigned request blocked (401)");
            else console.error(`❌ FAILURE: Unexpected status ${e.response?.status}`);
        }

        // 3. Try adding a route with HACKER signature (Should Fail)
        console.log(`\n[3] Attempting Hacker Signature (Should Fail)...`);
        const tsHacker = Date.now().toString();
        const msgHacker = `Update Routes for Merchant ${merchantId} at ${tsHacker}`;
        const sigHacker = await hacker.signMessage(msgHacker);

        try {
            await axios.post(`${BASE_URL}/${merchantId}/routes`, {
                method: "GET", path: "/test", price: "1", currency: "USDC"
            }, {
                headers: {
                    'x-signature': sigHacker,
                    'x-timestamp': tsHacker,
                    'x-merchant-id': merchantId
                }
            });
            console.error("❌ FAILURE: Hacker signature request succeeded (should be 403)");
        } catch (e: any) {
            if (e.response?.status === 403) console.log("✅ Success: Hacker signature blocked (403)");
            else console.error(`❌ FAILURE: Unexpected status ${e.response?.status}`);
        }

        // 4. Try adding a route with VALID signature (Should Succeed)
        console.log(`\n[4] Attempting Valid Signature (Should Succeed)...`);
        const ts = Date.now().toString();
        const msg = `Update Routes for Merchant ${merchantId} at ${ts}`;
        const sig = await wallet.signMessage(msg);

        const validRes = await axios.post(`${BASE_URL}/${merchantId}/routes`, {
            method: "GET", path: "/valid-test", price: "1", currency: "USDC"
        }, {
            headers: {
                'x-signature': sig,
                'x-timestamp': ts,
                'x-merchant-id': merchantId
            }
        });

        if (validRes.status === 201) console.log("✅ Success: Route added with valid signature");
        else console.error("❌ FAILURE: Valid signature request failed");

    } catch (error: any) {
        console.error("CRITICAL TEST FAILURE:", error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error("❌ ERROR: Connection Refused. Is the server running on port 5000?");
        }
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

runTest();
