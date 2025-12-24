"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface RouteStat {
    path: string;
    method: string;
    totalRevenue: number;
    requestCount: number;
    avgPrice: number;
    lastTransaction: string;
}

export default function RouteAnalyticsTable({ merchantId }: { merchantId: string }) {
    const [routes, setRoutes] = useState<RouteStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!merchantId) return;

        api.get(`/api/analytics/${merchantId}/routes`)
            .then((res) => setRoutes(res.data))
            .catch((err) => console.error("Failed to load route analytics", err))
            .finally(() => setLoading(false));
    }, [merchantId]);

    if (loading) return <div className="text-white/50 h-32 flex items-center justify-center">Loading route data...</div>;
    if (routes.length === 0) return <div className="text-gray-500 text-sm py-4">No paid API usage yet.</div>;

    return (
        <div className="glass-table-container">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr>
                        <th className="glass-header py-3 px-2">Path</th>
                        <th className="glass-header py-3 px-2 text-right">Calls</th>
                        <th className="glass-header py-3 px-2 text-right">Revenue</th>
                        <th className="glass-header py-3 px-2 text-right">Avg Price</th>
                        <th className="glass-header py-3 px-2 text-right">Last Used</th>
                    </tr>
                </thead>
                <tbody>
                    {routes.map((route, i) => (
                        <tr key={i} className="glass-row">
                            <td className="py-3 px-2 font-mono text-cyan-400">
                                <span className="text-xs text-gray-500 mr-2">{route.method}</span>
                                {route.path}
                            </td>
                            <td className="py-3 px-2 text-right">{route.requestCount}</td>
                            <td className="py-3 px-2 text-right text-green-400 font-medium">
                                {Number(route.totalRevenue).toFixed(2)}
                            </td>
                            <td className="py-3 px-2 text-right text-gray-400">
                                {Number(route.avgPrice).toFixed(2)}
                            </td>
                            <td className="py-3 px-2 text-right text-gray-500 text-xs">
                                {route.lastTransaction ? new Date(route.lastTransaction).toLocaleDateString() : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
