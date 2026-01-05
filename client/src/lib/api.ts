import axios from "axios";

// FORCE LOCALHOST for Development
const BASE_URL = "http://localhost:5000";

console.log("[API] Initializing with Base URL:", BASE_URL);

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});
