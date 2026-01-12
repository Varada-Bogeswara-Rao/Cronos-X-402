"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import MerchantForm from "@/components/MerchantForm";
import IntegrationDashboard from "@/components/IntegrationDashboard";
import AnalyticsTable from "@/components/analytics/AnalyticsTable";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function DashboardPage() {
    const { address, isConnected } = useAccount();
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const [activeTab, setActiveTab] = useState<"agent" | "merchant">("agent");

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    // Lookup merchant status whenever address changes
    useEffect(() => {
        const checkStatus = async () => {
            if (!address) {
                setMerchantId(null);
                return;
            }

            setCheckingStatus(true);
            try {
                // Call the lookup endpoint
                const res = await api.get(`/api/merchants/lookup/${address}`);
                setMerchantId(res.data.merchantId);
            } catch (error) {
                // If 404 or error, assume not registered
                setMerchantId(null);
            } finally {
                setCheckingStatus(false);
            }
        };

        if (isConnected && address) {
            checkStatus();
        } else {
            setMerchantId(null);
        }
    }, [address, isConnected]);

    const handleSuccess = (id: string) => {
        setMerchantId(id);
    };

    if (!isHydrated) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!isConnected || !address) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-center max-w-md px-4">
                    <div className="bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Wallet</h2>
                    <p className="text-gray-500">Please connect your wallet to access the merchant dashboard and view your integration details.</p>
                </div>
            </div>
        )
    }

    if (checkingStatus) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-500">Verifying merchant status...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 px-4 space-y-8">
            {/* Header & Toggle */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        {activeTab === "agent" ? "Agent Analytics" : "Merchant Console"}
                    </h1>
                    <p className="text-gray-400 mt-1">
                        {activeTab === "agent"
                            ? "Monitor autonomous payment activity logs."
                            : "Manage your monetized APIs and keys."}
                    </p>
                </div>

                <div className="bg-white/5 p-1 rounded-lg flex items-center border border-white/10 backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab("agent")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "agent"
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Agent View
                    </button>
                    <button
                        onClick={() => setActiveTab("merchant")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "merchant"
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Merchant View
                    </button>
                </div>
            </div>

            <hr className="border-white/10" />

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === "agent" ? (
                    isConnected && address ? (
                        <AnalyticsTable agentAddress={address} />
                    ) : (
                        <div className="text-center text-gray-500 py-20">Connect wallet to view analytics.</div>
                    )
                ) : (
                    !merchantId ? (
                        <div className="max-w-4xl mx-auto">
                            <MerchantForm
                                walletAddress={address!}
                                onSuccess={handleSuccess}
                            />
                        </div>
                    ) : (
                        <IntegrationDashboard merchantId={merchantId} />
                    )
                )}
            </div>
        </div>
    );
}
