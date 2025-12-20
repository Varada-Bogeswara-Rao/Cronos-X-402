'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect } from 'react'

export function ConnectButton() {
    const { address, isConnected } = useAccount()
    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    if (isConnected) {
        return (
            <div className="flex gap-4 items-center">
                <span className="text-sm font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button
                    onClick={() => disconnect()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                >
                    Disconnect
                </button>
            </div>
        )
    }

    // Filter for unique connectors by name to avoid duplicates if multiple are injected
    const uniqueConnectors = connectors.filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i)

    return (
        <div className="flex gap-2">
            {uniqueConnectors.map((connector) => (
                <button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                >
                    Connect {connector.name}
                </button>
            ))}
        </div>
    )
}
