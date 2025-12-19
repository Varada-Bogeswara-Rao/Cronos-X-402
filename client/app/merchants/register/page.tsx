'use client';

import React from 'react';
import MerchantForm from '@/components/MerchantForm';
import { IMerchant } from '../../types';

export default function RegisterPage() {
    const handleRegister = async (data: IMerchant) => {
        try {
            console.log('Submitting:', data);
            const response = await fetch('http://localhost:5000/api/merchants/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Registration failed');
            }

            const result = await response.json();
            alert('Merchant Registered Successfully! ID: ' + result.merchantId);
        } catch (error) {
            console.error(error);
            alert('Error registering merchant');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <MerchantForm onSubmit={handleRegister} />
            </div>
        </div>
    );
}
