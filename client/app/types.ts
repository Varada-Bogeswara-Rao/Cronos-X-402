export interface IMerchant {
    merchantId?: string;
    business: {
        name: string;
        description: string;
        contactEmail: string;
    };
    wallet: {
        address: string;
        network: 'cronos-mainnet' | 'cronos-testnet';
    };
    api: {
        baseUrl: string;
        routes: {
            method: 'GET' | 'POST' | 'PUT' | 'DELETE';
            path: string;
            price: string;
            currency: 'USDC' | 'CRO';
            description: string;
        }[];
    };
    limits: {
        maxRequestsPerMinute: number;
    };
    security: {
        ipWhitelist: string[];
    };
}
