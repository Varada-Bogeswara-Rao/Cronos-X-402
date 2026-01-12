import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { paymentMiddleware } from "../../../payment-middleware/dist/paymentMiddleware"; // Import compiled JS + Type defs
import Merchant from "../models/Merchant";
import ReplayKey from "../models/ReplayKey";

dotenv.config();

const BASE_URL = "http://localhost:5000";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

const log = (msg: string, success: boolean | null = null) => {
    if (success === true) console.log(`${GREEN}✅ ${msg}${RESET}`);
    else if (success === false) console.log(`${RED}❌ ${msg}${RESET}`);
    else console.log(`ℹ️  ${msg}`);
};

async function runTests() {
    log("Starting Security & Protocol Verification Suite...");

    // 1. Health Check
    try {
        const res = await axios.get(`${BASE_URL}/health`);
        if (res.status === 200 && res.data.status === 'healthy') log("Health Check Passed", true);
        else log("Health Check Failed", false);
    } catch (e: any) { log(`Health Check Error: ${e.message}`, false); }

    // Setup DB Connection for Setup
    if (process.env.MONGODB_URI) await mongoose.connect(process.env.MONGODB_URI);

    // ---------------------------------------------------------
    // SERVER SECURITY TESTS
    // ---------------------------------------------------------

    // 2. Replay Protection Integration Test
    log("\n--- Testing Replay Protection (Server) ---");
    const FAKE_NONCE = "nonce-" + Date.now();
    const FAKE_PROOF = "0x" + "1".repeat(64); // Fake 32-byte hash
    const MERCHANT_ID = "test-merchant-replay";

    // Ensure ReplayKey is clean
    await ReplayKey.deleteMany({ keyHash: { $regex: FAKE_NONCE } });

    // We need a valid-ish request that passes Zod validation
    const payload = {
        paymentProof: FAKE_PROOF,
        expectedAmount: "1.0",
        currency: "USDC",
        path: "/api/premium",
        method: "POST"
    };

    // First Request: Should fail at Chain Verify (500 or 402) BUT create Replay Key
    // OR it might fail at Merchant lookup first if we don't have one.
    // Let's create a dummy merchant first.
    await Merchant.findOneAndUpdate(
        { merchantId: MERCHANT_ID },
        {
            merchantId: MERCHANT_ID,
            status: { active: true },
            api: { routes: [{ method: 'POST', path: '/api/premium', active: true }] }
        },
        { upsert: true }
    );

    try {
        await axios.post(`${BASE_URL}/api/facilitator/verify`, payload, {
            headers: { "x-merchant-id": MERCHANT_ID, "x-nonce": FAKE_NONCE },
            validateStatus: () => true // Don't throw
        });
        // We expect this to fail verification (no tx on chain), but INSERT key.
    } catch (e) { }

    // Second Request: SAME Nonce -> Should fail with REPLAY_DETECTED
    const resReplay = await axios.post(`${BASE_URL}/api/facilitator/verify`, payload, {
        headers: { "x-merchant-id": MERCHANT_ID, "x-nonce": FAKE_NONCE },
        validateStatus: () => true
    });

    if (resReplay.status === 402 && resReplay.data.error === "REPLAY_DETECTED") {
        log("Replay Protection Active (Blocked reuse of nonce)", true);
    } else {
        log(`Replay Protection Failed! Status: ${resReplay.status}, Error: ${resReplay.data.error}`, false);
    }

    // 3. SSRF Protection Test
    log("\n--- Testing SSRF Protection (Server) ---");
    const MALICIOUS_ID = "evil-merchant";
    const UNSAFE_URL = "http://localhost:27017"; // Mongo port

    await Merchant.findOneAndUpdate(
        { merchantId: MALICIOUS_ID },
        {
            merchantId: MALICIOUS_ID,
            api: { baseUrl: UNSAFE_URL, routes: [{ method: 'GET', path: '/secret', active: true }] }
        },
        { upsert: true }
    );

    const resSSRF = await axios.get(`${BASE_URL}/api/sandbox/${MALICIOUS_ID}/secret`, {
        validateStatus: () => true
    });

    if (resSSRF.status === 403 && resSSRF.data.error === "UNSAFE_UPSTREAM") {
        log("SSRF Protection Active (Blocked private IP)", true);
    } else {
        log(`SSRF Protection Failed! Status: ${resSSRF.status}`, false);
    }

    // ---------------------------------------------------------
    // MIDDLEWARE UNIT TESTS (MOCK)
    // ---------------------------------------------------------
    log("\n--- Testing Payment Middleware Logic (Mock) ---");

    const mockReq: any = {
        method: 'POST',
        originalUrl: '/api/resource',
        headers: {},
        payment: {}
    };

    const mockRes: any = {
        status: (code: number) => ({
            set: (headers: any) => ({
                json: (body: any) => {
                    mockRes.lastResponse = { code, headers, body };
                }
            }),
            json: (body: any) => {
                mockRes.lastResponse = { code, body };
            }
        }),
        header: (k: string, v: string) => { }
    };

    const mockNext = () => { mockRes.nextCalled = true; };

    // Initialize middleware with failMode: closed
    const mw = paymentMiddleware({
        merchantId: "mw-test",
        gatewayUrl: "http://example.com",
        facilitatorUrl: "http://example.com",
        network: "cronos-testnet"
    });

    // Run Middleware (Missing Proof)
    await mw(mockReq, mockRes, mockNext);

    const response = mockRes.lastResponse;
    if (response) {
        if (response.code === 402) {
            log("Middleware returns 402 for missing proof", true);

            // Check for X-Nonce
            const nonce = response.headers['X-Nonce'];
            if (nonce && nonce.length > 8) log("Middleware generates Secure Nonce", true);
            else log("Middleware missing X-Nonce header", false);

            const expose = response.headers['Access-Control-Expose-Headers'];
            if (expose && expose.includes('x-nonce')) log("Middleware Exposes Headers (CORS)", true);
            else log("Middleware missing CORS Expose Headers", false);

        } else {
            log(`Middleware returned wrong status: ${response.code}`, false);
        }
    } else {
        log("Middleware did not respond!", false);
    }

    console.log("\nDone.");
    process.exit(0);
}

runTests();
