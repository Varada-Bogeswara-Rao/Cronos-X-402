// server/src/db.ts
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    // ---------------------------------------
    // 1. Fail fast if Mongo URI is missing
    // ---------------------------------------
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined");
    }

    // ---------------------------------------
    // 2. Safety check: NEVER allow localhost in production
    // ---------------------------------------
    if (
      process.env.NODE_ENV === "production" &&
      process.env.MONGODB_URI.includes("localhost")
    ) {
      throw new Error(
        "❌ Refusing to connect to localhost MongoDB in production"
      );
    }

    // ---------------------------------------
    // 3. Connect to Mongo
    // ---------------------------------------
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    // ---------------------------------------
    // 4. Explicit confirmation logs
    // ---------------------------------------
    console.log("✅ MongoDB Connected Successfully");
    console.log("🗄️  Host:", mongoose.connection.host);
    console.log("📦 DB:", mongoose.connection.name);

  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1); // HARD FAIL — do not run without DB
  }
};

export default connectDB;
