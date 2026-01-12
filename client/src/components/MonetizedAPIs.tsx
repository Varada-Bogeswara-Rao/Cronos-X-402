"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, CheckCircle2, XCircle, Loader2, MoreVertical, X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useSignMessage } from 'wagmi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Types ---

interface Route {
    _id: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    price: string;
    currency: "USDC" | "CRO";
    active: boolean;
}

interface MonetizedAPIsProps {
    merchantId: string;
}

// --- Validation Schema ---

const routeSchema = z.object({
    method: z.enum(["GET", "POST", "PUT", "DELETE"]),
    path: z.string().startsWith("/", "Path must start with /").min(2, "Path is required"),
    price: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid price format"),
    currency: z.enum(["USDC", "CRO"]),
});

type RouteFormData = z.infer<typeof routeSchema>;

// --- Component ---

export default function MonetizedAPIs({ merchantId }: MonetizedAPIsProps) {
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoute, setEditingRoute] = useState<Route | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Wagmi Signing Hook
    const { signMessageAsync } = useSignMessage();

    // Form Setup
    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<RouteFormData>({
        resolver: zodResolver(routeSchema),
        defaultValues: {
            method: "GET",
            currency: "USDC",
            path: "/",
            price: "0.1"
        }
    });

    // Helper: Generate Auth Headers
    const getAuthHeaders = async () => {
        const timestamp = Date.now().toString();
        const expiresAt = (Date.now() + 60_000).toString(); // 60s window
        const nonce = crypto.randomUUID();
        // Updated message format with expiry
        const message = `Update Routes:${merchantId}:${timestamp}:${expiresAt}:${nonce}`;

        try {
            const signature = await signMessageAsync({ message });
            return {
                'x-signature': signature,
                'x-timestamp': timestamp,
                'x-expires-at': expiresAt,
                'x-nonce': nonce,
                'x-merchant-id': merchantId
            };
        } catch (error) {
            console.error("Signing cancelled or failed", error);
            throw new Error("User denied signature");
        }
    };

    // ... later in the file ...

    // Fetch Routes
    const fetchRoutes = async () => {
        try {
            console.log("Fetching routes for:", merchantId);
            const res = await api.get(`/api/merchants/${merchantId}/routes`);
            setRoutes(res.data);
        } catch (error) {
            console.error("Failed to fetch routes", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (merchantId) fetchRoutes();
    }, [merchantId]);

    // Handlers
    const onSubmit = async (data: RouteFormData) => {
        setSubmitting(true);
        try {
            const headers = await getAuthHeaders();

            if (editingRoute) {
                // UPDATE
                await api.put(`/api/merchants/${merchantId}/routes/${editingRoute._id}`, {
                    price: data.price,
                }, { headers });
            } else {
                // CREATE
                await api.post(`/api/merchants/${merchantId}/routes`, data, { headers });
            }
            await fetchRoutes();
            closeModal();
        } catch (error) {
            console.error("Failed to save route", error);
            alert("Failed to save route. Did you sign the message?");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDisable = async (route: Route) => {
        try {
            const headers = await getAuthHeaders();
            // Toggle active status
            await api.put(`/api/merchants/${merchantId}/routes/${route._id}`, {
                active: !route.active,
            }, { headers });
            fetchRoutes();
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const handleDelete = async (routeId: string) => {
        if (!confirm("Are you sure you want to delete this route? This cannot be undone.")) return;
        try {
            const headers = await getAuthHeaders();
            await api.delete(`/api/merchants/${merchantId}/routes/${routeId}`, { headers });
            setRoutes(prev => prev.filter(r => r._id !== routeId));
        } catch (error) {
            console.error("Failed to delete route", error);
        }
    };

    const openEditModal = (route: Route) => {
        setEditingRoute(route);
        setValue("method", route.method);
        setValue("path", route.path);
        setValue("price", route.price);
        setValue("currency", route.currency);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRoute(null);
        reset({ method: "GET", path: "/", price: "0.1", currency: "USDC" });
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Monetized APIs</h2>
                    <p className="text-sm text-gray-400">Manage pricing and access for your API endpoints</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm shadow-blue-900/20"
                >
                    <Plus size={18} />
                    Add API
                </button>
            </div>

            {/* List / Empty State */}
            {routes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl bg-white/5">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 mb-4">
                        <Plus size={24} />
                    </div>
                    <h3 className="text-lg font-medium text-white">No Monetized APIs</h3>
                    <p className="text-gray-400 max-w-sm mx-auto mt-1">
                        Start monetizing your resources by adding your first API endpoint.
                    </p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 text-blue-400 font-medium hover:text-blue-300 hover:underline"
                    >
                        Create your first route
                    </button>
                </div>
            ) : (
                <div className="glass-table-container">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="glass-header w-[100px]">Method</th>
                                <th className="glass-header">Path</th>
                                <th className="glass-header">Price</th>
                                <th className="glass-header">Status</th>
                                <th className="glass-header text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {routes.map((route) => (
                                <tr key={route._id} className="glass-row group">
                                    <td className="py-4 px-4">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded font-medium text-xs border
                                                ${route.method === 'GET' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    route.method === 'POST' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                        route.method === 'DELETE' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                            'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}
                                        >
                                            {route.method}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 font-mono text-gray-300">
                                        {route.path}
                                    </td>
                                    <td className="py-4 px-4 font-medium text-white">
                                        {route.price} <span className="text-gray-500 text-xs">{route.currency}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        {route.active ? (
                                            <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                                Disabled
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <div className="flex items-center justify-end gap-2 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:5000";
                                                    const cleanPath = route.path.startsWith('/') ? route.path : `/${route.path}`;
                                                    const sandboxUrl = `${baseUrl}/api/sandbox/${merchantId}${cleanPath}`;
                                                    window.open(sandboxUrl, '_blank');
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-colors"
                                                title="Test in Sandbox"
                                            >
                                                <span className="text-xs font-bold">TEST</span>
                                            </button>
                                            <button
                                                onClick={() => handleDisable(route)}
                                                className={`p-1.5 rounded-md transition-colors ${route.active ? 'text-gray-400 hover:text-orange-400 hover:bg-orange-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                                                title={route.active ? "Disable" : "Enable"}
                                            >
                                                {route.active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                            </button>
                                            <button
                                                onClick={() => openEditModal(route)}
                                                className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                                                title="Edit configuration"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(route._id)}
                                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                                title="Delete route"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Config Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl scale-100 transition-all">
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">
                                {editingRoute ? "Edit API Route" : "Add New API"}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Method</label>
                                    <Controller
                                        name="method"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                disabled={!!editingRoute}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Method" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="GET">GET</SelectItem>
                                                    <SelectItem value="POST">POST</SelectItem>
                                                    <SelectItem value="PUT">PUT</SelectItem>
                                                    <SelectItem value="DELETE">DELETE</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Path</label>
                                    <input
                                        {...register("path")}
                                        disabled={!!editingRoute}
                                        placeholder="/api/v1/resource"
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 font-mono placeholder:text-gray-600"
                                    />
                                    {errors.path && <p className="text-red-400 text-xs mt-1">{errors.path.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Price</label>
                                    <div className="relative">
                                        <input
                                            {...register("price")}
                                            placeholder="0.05"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-gray-600"
                                        />
                                    </div>
                                    {errors.price && <p className="text-red-400 text-xs mt-1">{errors.price.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Currency</label>
                                    <Controller
                                        name="currency"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                disabled
                                            >
                                                <SelectTrigger>
                                                    <SelectValue>
                                                        {field.value === "USDC" ? "USDC (Polygon/Cronos)" : field.value}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="USDC">USDC (Polygon/Cronos)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            {editingRoute && (
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs rounded-lg">
                                    Editing path or method is disabled to prevent breaking existing integrations. Delete and recreate if needed.
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                >
                                    {submitting && <Loader2 size={16} className="animate-spin" />}
                                    {editingRoute ? "Save Changes" : "Create Route"}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div >
    );
}
