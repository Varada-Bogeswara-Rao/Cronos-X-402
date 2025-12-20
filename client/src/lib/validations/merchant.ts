import * as z from "zod";

export const routeSchema = z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    path: z.string().startsWith('/', "Path must start with /"),
    price: z.string().min(1, "Price is required"),
    currency: z.enum(['USDC', 'CRO']),
    description: z.string().optional(),
});

export const merchantSchema = z.object({
    business: z.object({
        name: z.string().min(3, "Name is too short"),
        description: z.string().optional(),
        contactEmail: z.string().email("Invalid email"),
    }),
    wallet: z.object({
        address: z.string(),
        network: z.enum(['cronos-mainnet', 'cronos-testnet']),
    }),
    api: z.object({
        baseUrl: z.string().url("Must be a valid URL (e.g., https://api.yourdomain.com)"),
        routes: z.array(routeSchema).min(1, "At least one route must be monetized"),
    }),
    limits: z.object({
        maxRequestsPerMinute: z.coerce.number().min(1).default(60),
    }),
});

export type MerchantFormValues = z.infer<typeof merchantSchema>;
