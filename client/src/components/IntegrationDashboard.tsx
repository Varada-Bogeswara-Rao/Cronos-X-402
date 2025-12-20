"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Copy, Check, Terminal, BarChart3, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import SalesFeed from "@/components/SalesFeed";

interface IntegrationDashboardProps {
    merchantId: string;
}

export default function IntegrationDashboard({ merchantId }: IntegrationDashboardProps) {
    const [copied, setCopied] = useState(false);
    const [stats, setStats] = useState({
        totalRevenue: "0.00",
        transactionCount: 0,
        recentSales: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get(`/api/merchants/${merchantId}/sales`);
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch merchant stats", error);
            } finally {
                setLoading(false);
            }
        };

        if (merchantId) {
            fetchStats();
            // Poll every 15 seconds for live updates
            const interval = setInterval(fetchStats, 15000);
            return () => clearInterval(interval);
        }
    }, [merchantId]);

    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.cronos-merchant.com";
    const snippet = `import { paymentMiddleware } from "@cronos-merchant/sdk";

app.use(paymentMiddleware({
  merchantId: "${merchantId}",
  gatewayUrl: "${gatewayUrl}",
  facilitatorUrl: "${gatewayUrl}/api/facilitator",
  network: "cronos-testnet"
}));`;

    const handleCopy = () => {
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">

            {/* SECTION 1: Success Confirmation */}
            <div className="bg-white border text-center border-green-200 bg-green-50/50 rounded-2xl p-8 shadow-sm">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Registration Complete</h1>
                        <p className="text-gray-600 mt-1">Your merchant account is active and ready to process payments.</p>
                    </div>
                    <div className="mt-2 bg-white px-4 py-2 rounded-lg border border-green-200 font-mono text-green-700 font-medium">
                        {merchantId}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Integration & Feed */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Sales Feed (New) */}
                    <SalesFeed sales={stats.recentSales} />

                    {/* SECTION 2: Integration Snippet */}
                    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="border-b border-gray-100 bg-gray-50/50 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-gray-700">
                                <Terminal size={18} />
                                <span className="font-semibold text-sm">Express.js Middleware</span>
                            </div>
                            <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">SDK (Coming Soon)</span>
                        </div>

                        <div className="relative group p-0">
                            <button
                                onClick={handleCopy}
                                className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white rounded-md transition-colors border border-white/10 backdrop-blur-sm"
                            >
                                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                            </button>
                            <pre className="bg-[#1e1e1e] text-gray-300 p-6 overflow-x-auto text-sm font-mono leading-relaxed">
                                <code>{snippet}</code>
                            </pre>
                        </div>
                    </section>

                    {/* SECTION 3: Next Steps */}
                    <section className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <ArrowRight className="text-blue-600 h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900">Next Step</h3>
                            <p className="text-blue-700/80 text-sm mt-1">Paste this middleware into your Express API. It will automatically intercept requests and require payment before proceeding.</p>
                        </div>
                    </section>
                </div>

                {/* Right Column: Metrics */}
                <div className="lg:col-span-1 space-y-4">
                    {/* SECTION 4: Live Analytics */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider ml-1">Live Analytics</h3>
                        {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500">Total Revenue</span>
                            <BarChart3 className="text-gray-300 h-4 w-4" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">${stats.totalRevenue}</div>
                        <div className="text-xs text-emerald-600 mt-1 font-medium">Synced on-chain</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500">Total Requests</span>
                            <BarChart3 className="text-gray-300 h-4 w-4" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stats.transactionCount}</div>
                        <div className="text-xs text-gray-400 mt-1">Successful payments</div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm opacity-60">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500">Yield APY</span>
                            <CheckCircle2 className="text-gray-300 h-4 w-4" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">--%</div>
                        <div className="text-xs text-gray-400 mt-1">Planned Feature</div>
                    </div>
                </div>

            </div>
        </div>
    );
}
