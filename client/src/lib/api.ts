import axios from "axios";

// Use Environment Variable or Fallback
const BASE_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

console.log("[API] Initializing with Base URL:", BASE_URL);

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});
