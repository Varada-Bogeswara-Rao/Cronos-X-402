import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] gap-6 p-4 text-center">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
        Accept Crypto Payments <br />
        <span className="text-blue-600">Seamlessly</span>
      </h1>

      <p className="text-gray-500 max-w-[600px] text-lg">
        The easiest way to integrate Cronos payments into your AI Agents and dApps.
        Register as a merchant to get started.
      </p>

      <div className="flex gap-4">
        <Link href="/dashboard">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
            Get Started via Dashboard
          </Button>
        </Link>

        <Link href="https://cronos.org" target="_blank">
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </Link>
      </div>
    </div>
  );
}
