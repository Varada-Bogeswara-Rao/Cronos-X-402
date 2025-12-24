"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AnalyticsData {
    totalRevenue: number;
    totalRequests: number;
    avgPrice: number;
    revenue24h: number;
    revenue7d: number;
}

export default function AnalyticsCards({ merchantId }: { merchantId: string }) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!merchantId) return;

        api.get(`/api/analytics/${merchantId}`)
            .then((res) => setData(res.data))
            .catch((err) => console.error("Failed to load analytics", err))
            .finally(() => setLoading(false));
    }, [merchantId]);

    if (loading) return <div className="text-white/50 animate-pulse">Loading stats...</div>;
    if (!data) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* 1. Total Revenue */}
            <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-sm text-gray-400 mb-1">Total Revenue</h3>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {Number(data.totalRevenue).toFixed(2)} USDC
                </div>
            </div>

            {/* 2. Total Requests */}
            <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-sm text-gray-400 mb-1">Paid Requests</h3>
                <div className="text-3xl font-bold text-white">
                    {data.totalRequests}
                </div>
            </div>

            {/* 3. Avg Price */}
            <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-sm text-gray-400 mb-1">Avg Price</h3>
                <div className="text-3xl font-bold text-white">
                    {Number(data.avgPrice).toFixed(2)} USDC
                </div>
            </div>

            {/* 4. 24h Trend */}
            <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-sm text-gray-400 mb-1">Last 24h Revenue</h3>
                <div className="text-3xl font-bold text-green-400">
                    +{Number(data.revenue24h).toFixed(2)} USDC
                </div>
            </div>
        </div>
    );
}
