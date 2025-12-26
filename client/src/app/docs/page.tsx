import IntegrationGuide from "@/components/IntegrationGuide";

export default function DocsPage() {
    return (
        <main className="min-h-screen bg-[#050505] flex justify-center pt-32 pb-20 px-6">
            <IntegrationGuide merchantId="YOUR_MERCHANT_ID" />
        </main>
    );
}
