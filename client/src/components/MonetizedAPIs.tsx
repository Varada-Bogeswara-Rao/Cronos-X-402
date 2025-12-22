"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, CheckCircle2, XCircle, Loader2, MoreVertical, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";

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
    currency: z.enum(["USDC", "CRO"]), // Allow CRO in schema to match backend type, even if UI restricts to USDC
});

type RouteFormData = z.infer<typeof routeSchema>;

// --- Component ---

export default function MonetizedAPIs({ merchantId }: MonetizedAPIsProps) {
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoute, setEditingRoute] = useState<Route | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form Setup
    const {
        register,
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

    // Fetch Routes
    const fetchRoutes = async () => {
        try {
            console.log("Fetching routes for:", merchantId);
            const res = await api.get(`/api/merchants/${merchantId}/routes`);
            console.log("Routes fetched:", res.data);
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
            if (editingRoute) {
                // UPDATE
                await api.put(`/api/merchants/${merchantId}/routes/${editingRoute._id}`, {
                    price: data.price,
                });
            } else {
                // CREATE
                await api.post(`/api/merchants/${merchantId}/routes`, data);
            }
            await fetchRoutes();
            closeModal();
        } catch (error) {
            console.error("Failed to save route", error);
            // Ideally show toast here
        } finally {
            setSubmitting(false);
        }
    };

    const handleDisable = async (route: Route) => {
        try {
            // Toggle active status
            await api.put(`/api/merchants/${merchantId}/routes/${route._id}`, {
                active: !route.active,
            });
            fetchRoutes();
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const handleDelete = async (routeId: string) => {
        if (!confirm("Are you sure you want to delete this route? This cannot be undone.")) return;
        try {
            await api.delete(`/api/merchants/${merchantId}/routes/${routeId}`);
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
                    <h2 className="text-xl font-bold text-gray-900">Monetized APIs</h2>
                    <p className="text-sm text-gray-500">Manage pricing and access for your API endpoints</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Add API
                </button>
            </div>

            {/* List / Empty State */}
            {routes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4">
                        <Plus size={24} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No Monetized APIs</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mt-1">
                        Start monetizing your resources by adding your first API endpoint.
                    </p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 text-blue-600 font-medium hover:underline"
                    >
                        Create your first route
                    </button>
                </div>
            ) : (
                <div className="bg-white border boundary-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Method</th>
                                    <th className="px-6 py-4 font-medium">Path</th>
                                    <th className="px-6 py-4 font-medium">Price</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {routes.map((route) => (
                                    <tr key={route._id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded font-medium text-xs
                                                ${route.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                                                        route.method === 'POST' ? 'bg-green-100 text-green-800' :
                                                            route.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                                                                'bg-orange-100 text-orange-800'}`}
                                            >
                                                {route.method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-700">
                                            {route.path}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {route.price} <span className="text-gray-500 text-xs">{route.currency}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {route.active ? (
                                                <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-gray-400 text-xs font-medium">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                                    Disabled
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleDisable(route)}
                                                    className={`p-1.5 rounded-md transition-colors ${route.active ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                                    title={route.active ? "Disable" : "Enable"}
                                                >
                                                    {route.active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(route)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                    title="Edit configuration"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(route._id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
                </div>
            )}

            {/* Config Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl scale-100 transition-all">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingRoute ? "Edit API Route" : "Add New API"}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                                    <select
                                        {...register("method")}
                                        disabled={!!editingRoute}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
                                    <input
                                        {...register("path")}
                                        disabled={!!editingRoute}
                                        placeholder="/api/v1/resource"
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 font-mono"
                                    />
                                    {errors.path && <p className="text-red-500 text-xs mt-1">{errors.path.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                                    <div className="relative">
                                        <input
                                            {...register("price")}
                                            placeholder="0.05"
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                                    <select
                                        {...register("currency")}
                                        disabled
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-500"
                                    >
                                        <option value="USDC">USDC (Polygon/Cronos)</option>
                                    </select>
                                </div>
                            </div>

                            {editingRoute && (
                                <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-lg">
                                    Editing path or method is disabled to prevent breaking existing integrations. Delete and recreate if needed.
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting && <Loader2 size={16} className="animate-spin" />}
                                    {editingRoute ? "Save Changes" : "Create Route"}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
