"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check, AlertTriangle } from "lucide-react";

interface IntegrationGuideProps {
    merchantId: string;
}

export default function IntegrationGuide({ merchantId }: IntegrationGuideProps) {
    const [copied, setCopied] = useState(false);

    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://cronos-x-402-production.up.railway.app";
    const snippet = `import { paymentMiddleware } from "./paymentMiddleware";

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
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-gray-900">Integration Guide</h2>
            </div>

            {/* A. Status Callout */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-yellow-600 h-5 w-5 mt-0.5 shrink-0" />
                <div>
                    <h3 className="font-bold text-yellow-900 text-sm">SDK Status: Coming Soon</h3>
                    <p className="text-yellow-800/90 text-sm mt-1">
                        The official SDK is currently in development. For now, please copy the middleware below directly into your Express backend to start processing payments.
                    </p>
                </div>
            </div>

            {/* B. Code Snippet */}
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-700">
                        <Terminal size={18} />
                        <span className="font-semibold text-sm">Express.js Middleware</span>
                    </div>
                </div>

                <div className="relative group p-0">
                    <button
                        onClick={handleCopy}
                        className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white rounded-md transition-colors border border-white/10 backdrop-blur-sm"
                        title="Copy to clipboard"
                    >
                        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                    <pre className="bg-[#1e1e1e] text-gray-300 p-6 overflow-x-auto text-sm font-mono leading-relaxed">
                        <code>{snippet}</code>
                    </pre>
                </div>
            </section>
        </div>
    );
}
