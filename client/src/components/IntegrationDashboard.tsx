"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import MonetizedAPIs from "@/components/MonetizedAPIs";

// New Components
import AnalyticsCards from "@/components/dashboard/AnalyticsCards";
import TransactionsTable from "@/components/dashboard/TransactionsTable";
import RouteAnalyticsTable from "@/components/dashboard/RouteAnalyticsTable";
import IntegrationGuide from "@/components/dashboard/IntegrationGuide"; // Use the new one

interface IntegrationDashboardProps {
    merchantId: string;
}

export default function IntegrationDashboard({ merchantId }: IntegrationDashboardProps) {

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">

            {/* HEADER: Welcome */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Merchant Dashboard</h1>
                    <p className="text-gray-400 text-sm">Monitor your API performance and revenue.</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-green-400 font-mono text-xs">{merchantId}</span>
                </div>
            </div>

            {/* 1. Global Analytics */}
            <AnalyticsCards merchantId={merchantId} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN (2/3) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* 2. Monetized APIs & Route Stats */}
                    <section className="space-y-6">
                        <div className="bg-black/20 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                            <MonetizedAPIs merchantId={merchantId} />
                        </div>

                        {/* Per-Route Analytics Table */}
                        <div className="bg-black/20 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-white mb-4">Route Performance</h3>
                            <RouteAnalyticsTable merchantId={merchantId} />
                        </div>
                    </section>

                    {/* 3. Recent Transactions */}
                    <section className="bg-black/20 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                        <TransactionsTable merchantId={merchantId} />
                    </section>

                </div>

                {/* RIGHT COLUMN (1/3) */}
                <div className="lg:col-span-1 space-y-8">
                    {/* 4. Documentation Link */}
                    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm">
                        <h3 className="text-lg font-bold text-white mb-2">Need Integration Help?</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Check out our complete integration guide, SDK documentation, and examples.
                        </p>
                        <a
                            href={`/integration?merchantId=${merchantId}`}
                            className="inline-flex items-center justify-center w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
                        >
                            View Docs & SDK
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
}
