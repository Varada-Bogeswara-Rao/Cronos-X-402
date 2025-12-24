"use client";

import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { merchantSchema, MerchantFormValues } from "@/lib/validations/merchant";
import { Plus, Trash2, Globe, Shield, CreditCard, Loader2 } from "lucide-react";
import { api } from "@/lib/api"; // Using helper
import { useState } from "react";
import { AxiosError } from "axios";

interface Props {
    walletAddress: string;
    onSuccess: (merchantId: string) => void;
}

export default function EnhancedMerchantForm({ walletAddress, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);

    const { register, control, handleSubmit, formState: { errors } } = useForm<MerchantFormValues>({
        resolver: zodResolver(merchantSchema) as any,
        defaultValues: {
            wallet: { address: walletAddress, network: "cronos-testnet" },
            api: { routes: [{ method: "GET", path: "/api/", price: "0.05", currency: "USDC" }] },
            limits: { maxRequestsPerMinute: 60 }
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "api.routes"
    });

    const onSubmit: SubmitHandler<MerchantFormValues> = async (data) => {
        setLoading(true);
        try {
            // Ensure wallet address is current (though defaultValues set it, good to ensure)
            const payload = {
                ...data,
                wallet: {
                    ...data.wallet,
                    address: walletAddress
                }
            };

            const res = await api.post("/api/merchants/register", payload);
            alert("Merchant Registered! You can now manage your routes using your wallet signature.");
            if (onSuccess) onSuccess(res.data.merchantId);
        } catch (err) {
            console.error(err);
            const error = err as AxiosError<{ message?: string }>;
            alert(error.response?.data?.message ?? "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-8 pb-20 w-full">
            {/* SECTION 1: Business Identity */}
            <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-white">
                <div className="flex items-center gap-3 mb-6">
                    <Globe className="text-orange-500" />
                    <h2 className="text-xl font-bold">Business Identity</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Company Name</label>
                        <input
                            {...register("business.name")}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            placeholder="My API Business"
                        />
                        {errors.business?.name && <p className="text-red-500 text-xs">{errors.business.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Support Email</label>
                        <input
                            {...register("business.contactEmail")}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            placeholder="support@example.com"
                        />
                        {errors.business?.contactEmail && <p className="text-red-500 text-xs">{errors.business.contactEmail.message}</p>}
                    </div>
                </div>
            </section>

            {/* SECTION 2: API Configuration */}
            <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-white">
                <div className="flex items-center gap-3 mb-6">
                    <CreditCard className="text-orange-500" />
                    <h2 className="text-xl font-bold">API Monetization</h2>
                </div>

                <div className="mb-6 space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Base API URL</label>
                    <input
                        {...register("api.baseUrl")}
                        placeholder="https://api.myapp.com"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    />
                    {errors.api?.baseUrl && <p className="text-red-500 text-xs">{errors.api.baseUrl.message}</p>}
                </div>

                <div className="space-y-4">
                    <p className="text-sm font-semibold uppercase text-zinc-500">Monetized Routes</p>
                    {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-12 gap-3 items-end bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                            <div className="col-span-2">
                                <select {...register(`api.routes.${index}.method`)} className="w-full bg-zinc-700 rounded p-2 text-sm border-none focus:ring-0 text-white">
                                    <option>GET</option><option>POST</option>
                                </select>
                            </div>
                            <div className="col-span-4">
                                <input {...register(`api.routes.${index}.path`)} placeholder="/v1/data" className="w-full bg-zinc-700 rounded p-2 text-sm text-white placeholder:text-zinc-500" />
                            </div>
                            <div className="col-span-2">
                                <input {...register(`api.routes.${index}.price`)} placeholder="0.05" className="w-full bg-zinc-700 rounded p-2 text-sm text-white placeholder:text-zinc-500" />
                            </div>
                            <div className="col-span-2">
                                <select {...register(`api.routes.${index}.currency`)} className="w-full bg-zinc-700 rounded p-2 text-sm border-none focus:ring-0 text-white">
                                    <option>USDC</option><option>CRO</option>
                                </select>
                            </div>
                            <div className="col-span-2 flex justify-end">
                                <button type="button" onClick={() => remove(index)} className="p-2 text-red-400 hover:bg-red-400/10 rounded">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => append({ method: "GET", path: "/", price: "0.01", currency: "USDC" })}
                        className="flex items-center gap-2 text-sm text-orange-500 hover:text-orange-400 font-medium pt-2"
                    >
                        <Plus size={16} /> Add Another Route
                    </button>
                </div>
            </section>

            {/* SUBMIT */}
            <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : null}
                Register Merchant & Generate ID
            </button>
        </form>
    );
}
