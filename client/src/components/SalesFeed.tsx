"use client";

import { ArrowUpRight, Receipt } from "lucide-react";

interface Sale {
    txHash: string;
    createdAt: string;
    amount: string;
    currency: string;
}

export default function SalesFeed({ sales }: { sales: Sale[] }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden text-white">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <Receipt size={18} className="text-orange-500" /> Recent Sales
                </h3>
            </div>
            <div className="divide-y divide-zinc-800">
                {sales.length === 0 ? (
                    <p className="p-8 text-center text-zinc-500">No sales yet. Waiting for AI Agents...</p>
                ) : (
                    sales.map((tx) => (
                        <div key={tx.txHash} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition">
                            <div>
                                <p className="text-sm font-mono text-zinc-300">{tx.txHash.slice(0, 10)}...</p>
                                <p className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-emerald-400 font-bold">+{tx.amount} {tx.currency}</p>
                                <a
                                    href={`https://explorer.cronos.org/testnet/tx/${tx.txHash}`}
                                    target="_blank"
                                    className="text-[10px] text-zinc-500 hover:text-orange-400 flex items-center gap-1"
                                >
                                    Verify <ArrowUpRight size={10} />
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
