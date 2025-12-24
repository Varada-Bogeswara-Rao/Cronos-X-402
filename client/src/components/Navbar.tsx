import Link from 'next/link'
import { ConnectButton } from './ConnectButton'

export function Navbar() {
    return (
        <nav className="sticky top-0 z-50 flex justify-between items-center py-6 px-8 bg-black/20 backdrop-blur-2xl border-b border-white/10 text-white transition-all duration-300">
            <Link href="/" className="text-xl font-bold tracking-tight text-blue-400">
                Cronos Gateway
            </Link>
            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors border border-white/10 rounded-lg hover:bg-white/5">
                    Dashboard
                </Link>
                <ConnectButton />
            </div>
        </nav>
    )
}
