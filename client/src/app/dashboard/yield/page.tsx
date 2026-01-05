"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import YieldDashboard from "@/components/yield/YieldDashboard";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function YieldPage() {
    const { address, isConnected } = useAccount();
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const resolveMerchant = async () => {
            if (!address) return;
            try {
                console.log("Fetching merchant for:", address);
                const res = await api.get(`/api/merchants/lookup/${address}`);
                setMerchantId(res.data.merchantId);
            } catch (e: any) {
                console.error("Merchant lookup failed", e);
                const msg = e.response?.data?.message || e.message;
                const url = e.config?.baseURL + e.config?.url;
                setError(`Failed to connect to Backend. Error: ${msg}. Endpoint: ${url}`);
            } finally {
                setLoading(false);
            }
        };

        if (isConnected && address) {
            resolveMerchant();
        } else {
            setLoading(false);
        }
    }, [address, isConnected]);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto py-20 text-center">
                <div className="max-w-md mx-auto p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    <h3 className="text-lg font-bold mb-2">Connection Error</h3>
                    <p className="text-sm mb-4">{error}</p>
                    <p className="text-xs text-gray-500">Ensure Server is running on Port 5000.</p>
                </div>
            </div>
        );
    }

    if (!isConnected || !address) {
        return (
            <div className="text-center py-20 text-gray-500">
                Please connect your wallet to view yield intelligence.
            </div>
        );
    }

    if (!merchantId) {
        return (
            <div className="text-center py-20 text-gray-500">
                <h3 className="text-lg font-medium text-gray-900">Merchant Not Found</h3>
                <p>Register on the main dashboard to initialize your account.</p>
            </div>
        );
    }

    // Render the Logic Component
    return (
        <div className="container mx-auto py-8">
            <YieldDashboard merchantId={merchantId} />
        </div>
    );
}
