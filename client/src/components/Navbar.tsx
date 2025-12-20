import Link from 'next/link'
import { ConnectButton } from './ConnectButton'

export function Navbar() {
    return (
        <nav className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-800 text-white">
            <Link href="/" className="text-xl font-bold tracking-tight text-blue-400">
                Cronos Gateway
            </Link>
            <ConnectButton />
        </nav>
    )
}
