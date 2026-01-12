import dns from 'dns/promises';
import { isPrivate } from 'ip';

/**
 * Validates that a URL is safe to proxy to (Anti-SSRF).
 * Blocks private IP ranges (localhost, 10.x, 192.168.x, etc.) and enforces HTTPS in production.
 * @param urlStr The URL to validate
 */
export async function validateUpstreamUrl(urlStr: string): Promise<boolean> {
    try {
        const url = new URL(urlStr);

        // [STRICT] Enforce HTTPS in production
        if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
            console.warn(`[SECURITY] Blocked non-HTTPS URL: ${urlStr}`);
            return false;
        }

        // Resolve hostname to IP
        const resolution = await dns.lookup(url.hostname);
        const ipAddress = resolution.address;

        // [STRICT] Block Private IPs
        if (isPrivate(ipAddress)) {
            console.warn(`[SECURITY] Blocked Private IP access: ${urlStr} -> ${ipAddress}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`[SECURITY] URL Validation failed for: ${urlStr}`, error);
        return false;
    }
}
