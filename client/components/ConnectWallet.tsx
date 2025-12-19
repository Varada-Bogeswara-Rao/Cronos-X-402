'use client';

import React from 'react';

interface ConnectWalletProps {
    onConnect: (address: string) => void;
    connectedAddress?: string;
}

const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect, connectedAddress }) => {
    const handleConnect = () => {
        // Mock connection
        const mockAddress = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        onConnect(mockAddress);
    };

    return (
        <div className="flex flex-col items-start gap-2">
            {!connectedAddress ? (
                <button
                    type="button"
                    onClick={handleConnect}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                    Connect Wallet
                </button>
            ) : (
                <div className="p-2 bg-green-100 border border-green-300 rounded text-green-800 text-sm font-mono">
                    Connected: {connectedAddress}
                </div>
            )}
        </div>
    );
};

export default ConnectWallet;
