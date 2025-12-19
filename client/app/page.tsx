import Link from 'next/link';
import { ArrowRight, ShieldCheck, Wallet, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center px-4 pt-20 pb-16 text-center sm:pt-32 sm:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          Cronos Merchant Gateway
        </h1>
        <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
          Accept crypto payments seamlessly on the Cronos chain. Secure, fast, and developer-friendly.
        </p>

        <div className="mt-10 flex gap-4 justify-center">
          <Link
            href="/merchants/register"
            className="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-lg"
          >
            Register Merchant <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <a
            href="https://cronos.org/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-6 py-3 text-base font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition"
          >
            Read Documentation
          </a>
        </div>
      </main>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-600">
              <Wallet className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Wallet Integration</h3>
            <p className="mt-2 text-gray-600">Connect directly with MetaMask and other Cronos-compatible wallets.</p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 text-green-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Secure Payments</h3>
            <p className="mt-2 text-gray-600">Enterprise-grade security with IP whitelisting and API key management.</p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 text-purple-600">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Instant Settlement</h3>
            <p className="mt-2 text-gray-600">Receive funds directly to your wallet with minimal latency.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Cronos Merchant Gateway. Built with Next.js & MERN.</p>
      </footer>
    </div>
  );
}
