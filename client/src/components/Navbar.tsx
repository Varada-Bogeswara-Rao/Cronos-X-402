import Link from 'next/link'
import { ConnectButton } from './ConnectButton'

export function Navbar() {
    return (
        <nav className="sticky top-0 z-50 flex justify-between items-center py-6 px-8 bg-black/20 backdrop-blur-2xl border-b border-white/10 text-white transition-all duration-300">
            <Link href="/" className="text-xl font-bold tracking-tight text-blue-400">
                Cronos Gateway
            </Link>
            <div className="flex items-center gap-4">
                <Link href="/docs" className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors border border-white/10 rounded-lg hover:bg-white/5">
                    Documentation
                </Link>
                <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors border border-white/10 rounded-lg hover:bg-white/5">
                    Dashboard
                </Link>
                <Link href="/dashboard/yield" className="px-4 py-2 text-sm font-medium text-blue-300 hover:text-blue-100 transition-colors border border-blue-500/20 rounded-lg hover:bg-blue-500/10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Yield Intel
                </Link>
                <ConnectButton />
            </div>
        </nav>
    )
}
