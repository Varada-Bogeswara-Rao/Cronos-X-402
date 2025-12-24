"use client";

import { useState } from "react";
import { Copy, Check, Terminal, ExternalLink } from "lucide-react";

export default function IntegrationGuide({ merchantId }: { merchantId: string }) {
    const [copied, setCopied] = useState(false);

    const curlCommand = `curl -X GET http://localhost:3001/posts \\
  -H "x-merchant-id: ${merchantId}"`;

    const copyCode = () => {
        navigator.clipboard.writeText(curlCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-black/20 border border-white/10 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="flex items-center justify-between mb-6 relative z-10">
                <h2 className="text-xl font-bold text-white">Integration Guide</h2>
                <a
                    href={`/integration?merchantId=${merchantId}`}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                    View Full Docs <ExternalLink size={12} />
                </a>
            </div>

            {/* 1. Warning Banner */}
            <div className="mb-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm flex gap-3 relative z-10">
                <div className="mt-0.5">⚠️</div>
                <div>
                    <p className="font-semibold mb-1">SDK Coming Soon</p>
                    <p className="opacity-80">For now, please manually copy the `paymentMiddleware.ts` into your server project.</p>
                </div>
            </div>

            {/* 2. Stepper */}
            <div className="mb-10 relative z-10">
                <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">How Payment Flow Works</h3>
                <div className="flex flex-col md:flex-row gap-4">
                    {[
                        { step: 1, title: "Client Request", desc: "User hits your API endpoint" },
                        { step: 2, title: "402 Payment Required", desc: "Middleware checks Price & blocks access" },
                        { step: 3, title: "Agent Payment", desc: "User pays via Cronos Chain" },
                        { step: 4, title: "Verification", desc: "Middleware verifies receipt with Facilitator" },
                        { step: 5, title: "Access Granted", desc: "Your API returns the data" },
                    ].map((s, i) => (
                        <div key={i} className="flex-1 bg-black/20 rounded-lg p-3 border border-white/5">
                            <div className="text-xs font-mono text-cyan-400 mb-1">0{s.step}</div>
                            <div className="font-semibold text-gray-200 text-sm mb-0.5">{s.title}</div>
                            <div className="text-xs text-gray-500 leading-snug">{s.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. Middleware Configuration */}
            <div className="mb-10 relative z-10">
                <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Server Configuration</h3>
                <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="text-blue-400">TypeScript</span>
                        </div>
                        <button
                            onClick={() => navigator.clipboard.writeText(`app.use(
  paymentMiddleware({
    merchantId: "${merchantId}",
    gatewayUrl: "https://cronos-x-402-production.up.railway.app",
    facilitatorUrl: "https://cronos-x-402-production.up.railway.app",
    network: "cronos-testnet",
  })
);`)}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                    <div className="p-4 font-mono text-sm text-gray-300 overflow-x-auto whitespace-pre">
                        {`app.use(
  paymentMiddleware({
    merchantId: "${merchantId}",
    gatewayUrl: "https://cronos-x-402-production.up.railway.app",
    facilitatorUrl: "https://cronos-x-402-production.up.railway.app",
    network: "cronos-testnet",
  })
);`}
                    </div>
                </div>
            </div>

            {/* 3. Test Your API Panel */}
            <div className="relative z-10">
                <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Test Your Integration</h3>

                <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Terminal size={14} />
                            <span>Terminal</span>
                        </div>
                        <button
                            onClick={copyCode}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                    </div>
                    <div className="p-4 font-mono text-sm text-gray-300 overflow-x-auto whitespace-pre">
                        {curlCommand}
                    </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                    You should receive a <span className="text-amber-400 font-mono">402 Payment Required</span> response if your middleware is working.
                </div>
            </div>
        </div>
    );
}
