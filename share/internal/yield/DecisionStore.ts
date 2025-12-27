import fs from "fs";
import path from "path";
import { YieldDecision, StoredDecision } from "./YieldDecision";

const FILE = path.join(process.cwd(), "yield_decisions.json");

export function loadDecisions(): StoredDecision[] {
    if (!fs.existsSync(FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(FILE, "utf-8"));
    } catch (e) {
        console.warn("Failed to parse decision store:", e);
        return [];
    }
}

export function saveDecision(decision: YieldDecision) {
    const existing = loadDecisions();

    // Replay Protection
    if (existing.some(d => d.nonce === decision.nonce)) {
        throw new Error(`Replay detected: Decision with nonce ${decision.nonce} already exists.`);
    }

    // Transform to StoredDecision (Add Lifecycle Status)
    const toStore: StoredDecision = {
        ...decision,
        status: "INGESTED", // Explicitly NOT executed
        ingestedAt: Math.floor(Date.now() / 1000)
    };

    existing.push(toStore);
    fs.writeFileSync(FILE, JSON.stringify(existing, null, 2));
}
