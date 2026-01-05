"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
    Activity,
    ArrowRight,
    ShieldCheck,
    TrendingUp,
    Wallet,
    AlertTriangle,
    Clock,
    Lock,
    RefreshCw
} from "lucide-react";

interface YieldDashboardProps {
    merchantId: string;
}

export default function YieldDashboard({ merchantId }: YieldDashboardProps) {
    const [statusData, setStatusData] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [statusRes, historyRes] = await Promise.all([
                api.get(`/api/yield/status?merchantId=${merchantId}`),
                api.get(`/api/yield/history?merchantId=${merchantId}&limit=20`)
            ]);
            setStatusData(statusRes.data);
            setHistory(historyRes.data);
        } catch (error) {
            console.error("Failed to fetch yield data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (merchantId) fetchData();
        const interval = setInterval(fetchData, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, [merchantId]);

    if (loading && !statusData) {
        return (
            <div className="flex justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!statusData) return null;

    const { status, reason, metrics, balances, config } = statusData;

    // Helper for currency formatting
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    const fmtCro = (n: number) => `${n.toFixed(2)} CRO`;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-zinc-200">
            {/* Header / Status Pill */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100">Yield Intelligence</h2>
                    <p className="text-sm text-zinc-500">Autonomous Treasury Management</p>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${status === "INVESTING" || status === "WITHDRAWING" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                        status === "DANGER_LOW_GAS" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                            "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    }`}>
                    {status === "INVESTING" && <TrendingUp className="h-4 w-4" />}
                    {status === "DANGER_LOW_GAS" && <AlertTriangle className="h-4 w-4" />}
                    {status === "HOLDING" && <Clock className="h-4 w-4" />}
                    <span className="font-medium text-sm">{status}</span>
                </div>
            </div>

            {/* Explanation Panel */}
            <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="flex gap-4 items-start">
                    <div className="bg-blue-500/10 p-2 rounded-lg">
                        <Activity className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-zinc-100">Agent Reasoning</h3>
                        <p className="text-zinc-400 mt-1">{reason}</p>
                        {status === "HOLDING" && metrics && (
                            <p className="text-xs text-zinc-500 mt-2">
                                Target Net Profit: &gt; ${config.minProfitUsd.toFixed(2)} | Current: ${metrics.netProfit?.toFixed(2)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Balances */}
                <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-xl">
                    <h4 className="flex items-center gap-2 text-sm text-zinc-500 mb-4 uppercase tracking-wider">
                        <Wallet className="h-4 w-4" /> Balances
                    </h4>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-zinc-400">USDC (Liquid)</span>
                            <span className="font-mono font-medium text-zinc-100 bg-zinc-800/50 px-2 py-0.5 rounded">{fmt(balances.usdc)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-400">CRO (Gas)</span>
                            <span className="font-mono font-medium text-zinc-100 bg-zinc-800/50 px-2 py-0.5 rounded">{fmtCro(balances.cro)}</span>
                        </div>
                        <div className="border-t border-zinc-800 pt-2 mt-2 flex justify-between text-blue-400">
                            <span>Tectonic (tUSDC)</span>
                            <span className="font-mono font-medium">{metrics ? fmt(metrics.totalValue) : "$0.00"}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Profit Metrics */}
                <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-xl">
                    <h4 className="flex items-center gap-2 text-sm text-zinc-500 mb-4 uppercase tracking-wider">
                        <TrendingUp className="h-4 w-4" /> Performance
                    </h4>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Unrealized Gain</span>
                            <span className="text-green-400 font-mono font-medium">
                                +{metrics ? fmt(metrics.unrealizedGain) : "$0.00"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Est. Withdraw Cost</span>
                            <span className="text-red-400 font-mono font-medium">
                                -{metrics ? fmt(metrics.withdrawCost) : "$0.00"}
                            </span>
                        </div>
                        <div className="border-t border-zinc-800 pt-2 mt-2 flex justify-between">
                            <span className="text-zinc-300">Net Profit</span>
                            <span className={`font-mono font-bold ${metrics?.netProfit > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                                {metrics ? fmt(metrics.netProfit) : "$0.00"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Autonomy Config */}
                <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ShieldCheck className="h-24 w-24 text-white" />
                    </div>
                    <h4 className="flex items-center gap-2 text-sm text-zinc-500 mb-4 uppercase tracking-wider">
                        <Lock className="h-4 w-4" /> Configuration
                    </h4>
                    <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-400">Autonomy</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.autonomyEnabled ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                                {config.autonomyEnabled ? "ACTIVE" : "PAUSED"}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-400">Mode</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.dryRun ? "bg-yellow-500/20 text-yellow-400" : "bg-purple-500/20 text-purple-400"}`}>
                                {config.dryRun ? "DRY RUN" : "LIVE EXECUTION"}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-4 leading-relaxed">
                            System is running in safe mode. No private keys are accessible from this dashboard.
                        </p>
                    </div>
                </div>
            </div>

            {/* Decision History Table */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                    <h3 className="font-semibold text-zinc-100">Decision Log</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-900 text-zinc-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Action</th>
                                <th className="px-6 py-3">Amount</th>
                                <th className="px-6 py-3">Reason</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                        No automated actions recorded recently.
                                    </td>
                                </tr>
                            ) : (
                                history.map((item: any) => (
                                    <tr key={item._id} className="hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                                            {new Date(item.issuedAt * 1000).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.decision === "FORCE_GAS_REFILL" ? "bg-red-500/20 text-red-400" :
                                                    item.decision === "APPROVE" ? "bg-green-500/20 text-green-400" :
                                                        "bg-zinc-700 text-zinc-300"
                                                }`}>
                                                {item.decision}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-zinc-300">
                                            {item.amount && item.amount !== "0" ?
                                                (Number(item.amount) / 1e6).toFixed(2) + " USDC" // Assume USDC for simplicity, correct for GAS REFILL?
                                                // Wait, GAS_REFILL amount is USDC too (input)
                                                : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-400 max-w-xs truncate" title={item.reason}>
                                            {item.reason || "Automated Decision"}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.status === "DISPATCHED" && (
                                                <span className="text-blue-400 flex items-center gap-1 text-xs">
                                                    <ArrowRight className="h-3 w-3" /> Dispatched
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
