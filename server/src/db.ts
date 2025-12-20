// server/src/db.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cronos-merchant-gateway';
        
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000, // 🛡️ Don't wait forever if DB is down
            maxPoolSize: 10,               // 🛡️ Limit connections for efficiency
        });

        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1); // Kill process if DB is unreachable
    }
};

export default connectDB;