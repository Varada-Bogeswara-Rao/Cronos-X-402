'use client';

import React from 'react';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { IMerchant } from '../app/types';
import ConnectWallet from './ConnectWallet';

interface MerchantFormProps {
    onSubmit: (data: IMerchant) => void;
    isLoading?: boolean;
}

const MerchantForm: React.FC<MerchantFormProps> = ({ onSubmit, isLoading }) => {
    const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<IMerchant>({
        defaultValues: {
            business: { name: '', email: '', description: '' }, // note: email mapped to contactEmail in transform
            wallet: { network: 'cronos-testnet' },
            api: { baseUrl: '', routes: [{ method: 'POST', path: '', price: '0', currency: 'CRO', description: '' }] },
            limits: { maxRequestsPerMinute: 60 }
        } as any
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "api.routes"
    });

    const walletAddress = watch('wallet.address');

    const onWalletConnect = (address: string) => {
        setValue('wallet.address', address);
    };

    const handleFormSubmit: SubmitHandler<IMerchant> = (data) => {
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 max-w-2xl mx-auto p-6 bg-white shadow rounded-lg">
            <h2 className="text-2xl font-bold text-gray-800">Register Merchant</h2>

            {/* Business Details */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-700">Business Details</h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Business Name</label>
                    <input
                        {...register('business.name', { required: 'Name is required' })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                    />
                    {errors.business?.name && <span className="text-red-500 text-sm">{errors.business.name.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                    <input
                        {...register('business.contactEmail', { required: 'Email is required' })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                        {...register('business.description')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                    />
                </div>
            </section>

            {/* Wallet */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-700">Wallet</h3>
                <ConnectWallet onConnect={onWalletConnect} connectedAddress={walletAddress} />
                <input type="hidden" {...register('wallet.address', { required: 'Wallet connection required' })} />
                {errors.wallet?.address && <span className="text-red-500 text-sm">{errors.wallet.address.message}</span>}

                <div>
                    <label className="block text-sm font-medium text-gray-700">Network</label>
                    <select {...register('wallet.network')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
                        <option value="cronos-testnet">Cronos Testnet</option>
                        <option value="cronos-mainnet">Cronos Mainnet</option>
                    </select>
                </div>
            </section>

            {/* API Configuration */}
            <section className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-700">API Configuration</h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Base URL</label>
                    <input
                        {...register('api.baseUrl', { required: 'Base URL is required' })}
                        placeholder="https://api.example.com"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Routes</label>
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-start border p-2 rounded bg-gray-50">
                            <div className="grid grid-cols-2 gap-2 flex-1">
                                <input {...register(`api.routes.${index}.method`)} className="p-1 border rounded" placeholder="Method" />
                                <input {...register(`api.routes.${index}.path`)} className="p-1 border rounded" placeholder="/path" />
                                <input {...register(`api.routes.${index}.price`)} className="p-1 border rounded" placeholder="Price" />
                                <select {...register(`api.routes.${index}.currency`)} className="p-1 border rounded">
                                    <option value="USDC">USDC</option>
                                    <option value="CRO">CRO</option>
                                </select>
                            </div>
                            <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700">X</button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => append({ method: 'POST', path: '', price: '', currency: 'CRO', description: '' })}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        + Add Route
                    </button>
                </div>
            </section>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
            >
                {isLoading ? 'Registering...' : 'Register Merchant'}
            </button>
        </form>
    );
};

export default MerchantForm;
