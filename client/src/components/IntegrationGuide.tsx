"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check, ShieldCheck, Server, Zap, Info, LayoutTemplate } from "lucide-react";

interface IntegrationGuideProps {
    merchantId: string;
}

export default function IntegrationGuide({ merchantId }: IntegrationGuideProps) {
    const [copied, setCopied] = useState(false);

    // Dynamic Gateway URL from env or fallback to production
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://cronos-x-402-production.up.railway.app";

    const snippet = `// Install dependency first: npm install axios
import { paymentMiddleware } from "./paymentMiddleware";

// Paste this before your routes
app.use(paymentMiddleware({
  merchantId: "${merchantId}", 
  gatewayUrl: "${gatewayUrl}", // Authentication & Pricing
  facilitatorUrl: "${gatewayUrl}", // Payment Verification
  network: "cronos-testnet"
}));`;

    const handleCopy = () => {
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-8 max-w-4xl">

            {/* A. Production Status Callout */}
            <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-500/20 rounded-lg p-2 mt-1 border border-blue-500/30">
                        <ShieldCheck className="text-blue-400 h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-blue-100">Production Integration (SDK Mode)</h3>
                        <p className="text-blue-200/70 mt-1 leading-relaxed">
                            You’ve successfully tested your API in the Sandbox.
                            The next step is to enforce payments directly inside your backend using the x402 middleware.
                        </p>
                    </div>
                </div>
            </div>

            {/* B. Architecture Explanation */}
            <section className="bg-black/20 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Server size={20} className="text-gray-400" />
                    How x402 Works in Your Backend
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <span className="block font-semibold text-white mb-1">1. Request</span>
                        <p className="text-gray-400">Client requests hit your API normally. No special ports required.</p>
                    </div>
                    <div className="bg-purple-500/10 p-4 rounded-xl border border-purple-500/20">
                        <span className="block font-semibold text-purple-200 mb-1">2. Verification</span>
                        <p className="text-purple-200/60">Middleware checks `X-Payment-Proof` header. No API keys exposed.</p>
                    </div>
                    <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                        <span className="block font-semibold text-green-200 mb-1">3. Enforcement</span>
                        <p className="text-green-200/60">If unpaid → returns 402. <br />If paid → `next()` passes to your logic.</p>
                    </div>
                </div>
            </section>

            {/* C. Copy-Paste Integration */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-white font-bold">
                        <Terminal size={20} className="text-gray-400" />
                        <h2>Integration Code</h2>
                    </div>
                    <span className="text-xs font-mono bg-white/10 text-gray-300 px-2 py-1 rounded border border-white/5">Express.js (Node.js)</span>
                </div>

                <div className="relative group rounded-2xl overflow-hidden shadow-lg border border-white/10">
                    <div className="absolute top-0 right-0 p-4 z-10">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white px-3 py-1.5 rounded-lg transition-all backdrop-blur-md border border-white/10"
                        >
                            {copied ? (
                                <>
                                    <Check size={14} className="text-green-400" />
                                    <span className="text-xs font-semibold text-green-400">Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={14} />
                                    <span className="text-xs font-medium">Copy Snippet</span>
                                </>
                            )}
                        </button>
                    </div>
                    <pre className="bg-black/40 text-gray-300 p-6 pt-12 overflow-x-auto text-sm font-mono leading-relaxed">
                        <code>{snippet}</code>
                    </pre>
                </div>
                <p className="text-xs text-center text-gray-500">
                    Paste this snippet immediately before your API route definitions.
                </p>
            </section>


            <div className="grid md:grid-cols-2 gap-6">
                {/* D. What Happens After */}
                <section className="bg-black/20 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-amber-400" />
                        What to Expect
                    </h3>
                    <ul className="space-y-3 text-sm text-gray-400">
                        <li className="flex gap-2">
                            <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                            Unpaid requests receive <code className="text-xs bg-white/10 px-1 rounded text-gray-300">402 Payment Required</code>
                        </li>
                        <li className="flex gap-2">
                            <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                            Paid requests pass through automatically to your controllers
                        </li>
                        <li className="flex gap-2">
                            <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                            Transactions appear in your Dashboard Analytics real-time
                        </li>
                    </ul>
                </section>

                {/* E. Sandbox vs SDK */}
                <section className="bg-black/20 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <LayoutTemplate size={20} className="text-indigo-400" />
                        Sandbox vs Production
                    </h3>
                    <div className="space-y-4 text-sm">
                        <div className="flex gap-3 items-start">
                            <div className="bg-white/5 p-1.5 rounded border border-white/10 shrink-0">
                                🧪
                            </div>
                            <div>
                                <span className="block font-semibold text-white">Sandbox Mode</span>
                                <span className="text-gray-500">Test enforcement via Cronos Gateway proxy. No code integration required.</span>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="bg-white/5 p-1.5 rounded border border-white/10 shrink-0">
                                🚀
                            </div>
                            <div>
                                <span className="block font-semibold text-white">SDK Mode (Recommended)</span>
                                <span className="text-gray-500">Use the middleware package for production. SDK is recommended for AI agents.</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

        </div>
    );
}
