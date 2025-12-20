"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import MerchantForm from "@/components/MerchantForm";
import IntegrationDashboard from "@/components/IntegrationDashboard";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
    const { address, isConnected } = useAccount();
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    // Persistence & Hydration Logic
    useEffect(() => {
        setIsHydrated(true);
        const stored = localStorage.getItem("merchantId");
        if (stored) setMerchantId(stored);
    }, []);

    const handleSuccess = (id: string) => {
        localStorage.setItem("merchantId", id);
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

    return (
        <div className="container mx-auto py-12 px-4">
            {!merchantId ? (
                // If connected but no merchantId -> Registration Form
                <div className="max-w-4xl mx-auto">
                    <MerchantForm
                        walletAddress={address}
                        onSuccess={handleSuccess}
                    />
                </div>
            ) : (
                // If connected AND merchantId -> Integration Dashboard
                <IntegrationDashboard merchantId={merchantId} />
            )}
        </div>
    );
}
