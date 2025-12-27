import fs from "fs";
import path from "path";
import { YieldSnapshot } from "./YieldSnapshot";

const SNAPSHOT_FILE = path.join(
    process.cwd(),
    "yield_snapshots.json"
);

// Custom replacer for BigInt serialization
function bigIntReplacer(_key: string, value: any) {
    if (typeof value === "bigint") {
        return value.toString();
    }
    return value;
}

// Custom reviver for BigInt deserialization
// Note: We only revive known BigInt fields to avoid reviving generic strings
function snapshotReviver(key: string, value: any) {
    if (key === "shares" || key === "underlyingValue") {
        return BigInt(value);
    }
    return value;
}

export function saveSnapshot(snapshot: YieldSnapshot) {
    const existing = loadSnapshots();
    existing.push(snapshot);

    // Performance: Keep only last 100 snapshots to prevent infinite growth
    if (existing.length > 100) {
        existing.splice(0, existing.length - 100);
    }

    const data = JSON.stringify(existing, bigIntReplacer, 2);
    fs.writeFileSync(SNAPSHOT_FILE, data);
}

export function loadSnapshots(): YieldSnapshot[] {
    if (!fs.existsSync(SNAPSHOT_FILE)) return [];

    const rawData = fs.readFileSync(SNAPSHOT_FILE, "utf-8");
    try {
        return JSON.parse(rawData, snapshotReviver);
    } catch (error) {
        console.warn("Failed to parse snapshots, starting fresh.", error);
        return [];
    }
}
