"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns"; // Standard relative time
import { CheckCircle2, XCircle, Clock, Search, AlertCircle, ArrowUpRight, Loader2, ShieldAlert, CheckCircle } from "lucide-react";
import { CRONOS_EXPLORER } from "@/lib/explorer";
import { api } from "@/lib/api";

type PaymentLog = {
    _id: string;
    timestamp: string;
    url: string;
    amount: number;
    currency: string;
    decision: "APPROVED" | "BLOCKED";
    reason?: string;
    txHash?: string;
};

export default function AnalyticsTable({ agentAddress }: { agentAddress: string }) {
    const [logs, setLogs] = useState<PaymentLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get(`/api/analytics/history?agentAddress=${agentAddress}&limit=50`);
                setLogs(res.data);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        };

        if (agentAddress) fetchLogs();
    }, [agentAddress]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>;

    if (logs.length === 0) {
        return (
            <div className="glass-panel p-8 text-center text-gray-500">
                <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No activity recorded yet for this Agent.</p>
            </div>
        );
    }

    return (
        <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Agent Activity Log</h3>
                <span className="text-xs text-gray-400 bg-black/20 px-2 py-1 rounded-full">
                    Last 50 Events
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-gray-400 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3">Decision</th>
                            <th className="px-4 py-3">Task / Domain</th>
                            <th className="px-4 py-3">Cost</th>
                            <th className="px-4 py-3">Reason / Context</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <tr key={log._id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                </td>
                                <td className="px-4 py-3">
                                    {log.decision === "APPROVED" ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                            <CheckCircle className="w-3 h-3" /> Paid
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                            <XCircle className="w-3 h-3" /> Blocked
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-white truncate max-w-[200px]" title={log.url}>
                                    {new URL(log.url).hostname}
                                </td>
                                <td className="px-4 py-3 text-white font-mono">
                                    {log.amount > 0 ? `$${log.amount}` : "-"}
                                </td>
                                <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">
                                    {log.decision === "BLOCKED" ? (
                                        <span className="text-red-300">{log.reason}</span>
                                    ) : (
                                        log.txHash ? (
                                            <a
                                                href={`${CRONOS_EXPLORER}/tx/${log.txHash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-400 font-mono hover:text-blue-300 transition-colors"
                                            >
                                                {log.txHash.slice(0, 6)}...{log.txHash.slice(-4)}
                                            </a>
                                        ) : "—"
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
