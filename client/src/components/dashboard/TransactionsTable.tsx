"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Transaction {
    _id: string;
    txHash: string;
    amount: string;
    currency: string;
    path: string;
    method: string;
    createdAt: string;
}

export default function TransactionsTable({ merchantId }: { merchantId: string }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!merchantId) return;

        setLoading(true);
        api.get(`/api/transactions/${merchantId}?page=${page}&limit=10`)
            .then((res) => {
                setTransactions(res.data.transactions);
                setTotalPages(res.data.pagination.pages);
            })
            .catch((err) => console.error("Failed to load txs", err))
            .finally(() => setLoading(false));
    }, [merchantId, page]);

    // Handle modal or explorer link
    const openExplorer = (hash: string) => {
        window.open(`https://explorer.cronos.org/testnet/tx/${hash}`, '_blank');
    };

    if (!merchantId) return null;

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm bg-white/5 hover:bg-white/10 rounded disabled:opacity-50 text-gray-300"
                    >
                        Prev
                    </button>
                    <span className="text-gray-400 text-sm py-1">Page {page} of {totalPages || 1}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="px-3 py-1 text-sm bg-white/5 hover:bg-white/10 rounded disabled:opacity-50 text-gray-300"
                    >
                        Next
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
                    ))}
                </div>
            ) : transactions.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    No transactions found.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-400 text-xs border-b border-white/10 uppercase tracking-wider">
                                <th className="py-4 px-4">Date</th>
                                <th className="py-4 px-4">Route</th>
                                <th className="py-4 px-4">Amount</th>
                                <th className="py-4 px-4">Tx Hash</th>
                                <th className="py-4 px-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx) => (
                                <tr key={tx._id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-sm text-gray-300 group">
                                    <td className="py-4 px-4 text-gray-400 whitespace-nowrap">
                                        {new Date(tx.createdAt).toLocaleString()}
                                    </td>
                                    <td className="py-4 px-4 font-mono text-cyan-300">
                                        <span className="text-xs text-gray-500 mr-2">{tx.method}</span>
                                        {tx.path}
                                    </td>
                                    <td className="py-4 px-4 font-medium text-white">
                                        {Number(tx.amount).toFixed(2)} <span className="text-xs text-gray-500">{tx.currency}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <button
                                            onClick={() => openExplorer(tx.txHash)}
                                            className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs truncate max-w-[120px] block"
                                        >
                                            {tx.txHash}
                                        </button>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                            Verified
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
