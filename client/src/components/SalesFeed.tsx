"use client";

import { ArrowUpRight, Receipt } from "lucide-react";
import { CRONOS_EXPLORER } from "@/lib/explorer";

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
                    sales.map((sale) => (
                        <div key={sale.txHash} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition">
                            <div>
                                <p className="text-sm font-mono text-zinc-300">{sale.txHash.slice(0, 10)}...</p>
                                <p className="text-xs text-zinc-500">{new Date(sale.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-emerald-400 font-bold">+{sale.amount} {sale.currency}</p>
                                <a
                                    href={`${CRONOS_EXPLORER}/tx/${sale.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-400 hover:underline"
                                >
                                    View TX
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
