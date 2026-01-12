export const CRONOS_EXPLORER =
    process.env.NEXT_PUBLIC_NETWORK === "cronos-mainnet"
        ? "https://explorer.cronos.org"
        : "https://explorer.cronos.org/testnet";
