import express from "express";
import { paymentMiddleware } from "./paymentMiddleware.js";

const app = express();
app.use(express.json());

// 1️⃣ Apply payment middleware
app.use(paymentMiddleware({
  merchantId: "b9805b9e-fa6c-4640-8470-f5b230dee6d4",
  gatewayUrl: "https://cronos-x-402-production.up.railway.app",
  facilitatorUrl: "https://cronos-x-402-production.up.railway.app",
  network: "cronos-testnet"
}));

// 2️⃣ DEFINE THE ROUTE (Matching your registered /posts)
// 2️⃣ DEFINE THE ROUTES (Must match what you register in Dashboard)

app.get("/posts", async (req, res) => {
  const r = await fetch("https://jsonplaceholder.typicode.com/posts");
  res.json(await r.json());
});

app.get("/users", async (req, res) => {
  const r = await fetch("https://jsonplaceholder.typicode.com/users");
  res.json(await r.json());
});

app.get("/comments", async (req, res) => {
  const r = await fetch("https://jsonplaceholder.typicode.com/comments");
  res.json(await r.json());
});

app.get("/photos", async (req, res) => {
  const r = await fetch("https://jsonplaceholder.typicode.com/photos");
  // Limit to 5 photos so it's not huge
  const data = await r.json();
  res.json(data.slice(0, 5));
});

// 3️⃣ LISTEN ONCE
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Merchant Server running at http://localhost:${PORT}`);
});
