"use client";

import { useSearchParams } from "next/navigation";
import IntegrationGuide from "@/components/dashboard/IntegrationGuide";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function IntegrationContent() {
    const searchParams = useSearchParams();
    const merchantId = searchParams.get("merchantId") || "YOUR_MERCHANT_ID";

    return <IntegrationGuide merchantId={merchantId} />;
}

export default function IntegrationPage() {
    return (
        <div className="min-h-screen bg-[#0a0f1c] text-white p-8">
            <div className="max-w-4xl mx-auto">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </Link>

                <h1 className="text-3xl font-bold mb-2">Integration Documentation</h1>
                <p className="text-gray-400 mb-8">Complete guide to integrating Cronos x402 payments into your application.</p>

                <Suspense fallback={<div className="text-gray-500">Loading integration details...</div>}>
                    <IntegrationContent />
                </Suspense>

                {/* Additional Documentation Content can go here */}
                <div className="mt-12 prose prose-invert max-w-none">
                    <h3>Next Steps</h3>
                    <p>
                        Once you have verified the payment flow using the `demo.ts` script, you can install the SDK (coming soon)
                        or use the middleware logic in your own backend.
                    </p>
                </div>
            </div>
        </div>
    );
}
